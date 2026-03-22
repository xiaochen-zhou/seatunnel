/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.seatunnel.transform.jsonpath;

import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.JsonNode;

import org.apache.seatunnel.api.table.catalog.CatalogTable;
import org.apache.seatunnel.api.table.catalog.Column;
import org.apache.seatunnel.api.table.type.SeaTunnelDataType;
import org.apache.seatunnel.api.table.type.SeaTunnelRow;
import org.apache.seatunnel.api.table.type.SeaTunnelRowAccessor;
import org.apache.seatunnel.api.table.type.SeaTunnelRowType;
import org.apache.seatunnel.common.exception.CommonError;
import org.apache.seatunnel.common.utils.JsonUtils;
import org.apache.seatunnel.format.json.JsonToRowConverters;
import org.apache.seatunnel.transform.common.MultipleFieldOutputTransform;
import org.apache.seatunnel.transform.exception.ErrorDataTransformException;
import org.apache.seatunnel.transform.exception.TransformCommonError;

import com.jayway.jsonpath.Configuration;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.JsonPathException;
import com.jayway.jsonpath.ParseContext;
import com.jayway.jsonpath.ReadContext;
import lombok.extern.slf4j.Slf4j;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.apache.seatunnel.transform.exception.JsonPathTransformErrorCode.JSON_PATH_COMPILE_ERROR;

@Slf4j
public class JsonPathTransform extends MultipleFieldOutputTransform {

    public static final String PLUGIN_NAME = "JsonPath";

    /** Reusable ParseContext to avoid creating new instances for each parse operation. */
    private static final ParseContext PARSE_CONTEXT =
            JsonPath.using(Configuration.defaultConfiguration());

    private final JsonPathTransformConfig config;
    private final SeaTunnelRowType seaTunnelRowType;

    private JsonToRowConverters.JsonToObjectConverter[] converters;
    private Column[] outputColumns;

    private int[] srcFieldIndexArr;

    /** Pre-compiled JsonPath instances for each column config. */
    private JsonPath[] compiledPaths;

    /**
     * Groups column configs by srcField index for ReadContext reuse. Key: srcField index in
     * seaTunnelRowType Value: List of indices in the columnConfigs list
     */
    private Map<Integer, List<Integer>> srcFieldToConfigIndices;

    public JsonPathTransform(JsonPathTransformConfig config, CatalogTable catalogTable) {
        super(catalogTable, config.getErrorHandleWay());
        this.config = config;
        this.seaTunnelRowType = catalogTable.getSeaTunnelRowType();
        init();
    }

    @Override
    public String getPluginName() {
        return PLUGIN_NAME;
    }

    private void init() {
        initSrcFieldIndexArr();
        initOutputSeaTunnelRowType();
        initConverters();
        initCompiledPaths();
        initSrcFieldGroups();
    }

    private void initConverters() {
        JsonToRowConverters jsonToRowConverters = new JsonToRowConverters(false, false);
        this.converters =
                this.config.getColumnConfigs().stream()
                        .map(ColumnConfig::getDestType)
                        .map(jsonToRowConverters::createConverter)
                        .toArray(JsonToRowConverters.JsonToObjectConverter[]::new);
    }

    private void initOutputSeaTunnelRowType() {
        this.outputColumns =
                this.config.getColumnConfigs().stream()
                        .map(ColumnConfig::getDestColumn)
                        .toArray(Column[]::new);
    }

    private void initSrcFieldIndexArr() {
        List<ColumnConfig> columnConfigs = this.config.getColumnConfigs();
        Set<String> fieldNameSet = new HashSet<>(Arrays.asList(seaTunnelRowType.getFieldNames()));
        this.srcFieldIndexArr = new int[columnConfigs.size()];

        for (int i = 0; i < columnConfigs.size(); i++) {
            ColumnConfig columnConfig = columnConfigs.get(i);
            String srcField = columnConfig.getSrcField();
            if (!fieldNameSet.contains(srcField)) {
                throw TransformCommonError.cannotFindInputFieldError(getPluginName(), srcField);
            }
            this.srcFieldIndexArr[i] = seaTunnelRowType.indexOf(srcField);
        }
    }

    /** Pre-compile all JsonPath expressions to avoid repeated compilation during transformation. */
    private void initCompiledPaths() {
        this.compiledPaths =
                this.config.getColumnConfigs().stream()
                        .map(col -> JsonPath.compile(col.getPath()))
                        .toArray(JsonPath[]::new);
    }

    /**
     * Group column configs by srcField index to enable ReadContext reuse. When multiple columns
     * extract from the same source field, we only need to parse the JSON once.
     */
    private void initSrcFieldGroups() {
        this.srcFieldToConfigIndices =
                IntStream.range(0, srcFieldIndexArr.length)
                        .boxed()
                        .collect(Collectors.groupingBy(i -> srcFieldIndexArr[i]));
    }

    @Override
    protected Object[] getOutputFieldValues(SeaTunnelRowAccessor inputRow) {
        List<ColumnConfig> configs = this.config.getColumnConfigs();
        Object[] fieldValues = new Object[configs.size()];

        for (Map.Entry<Integer, List<Integer>> entry : srcFieldToConfigIndices.entrySet()) {
            int srcFieldIndex = entry.getKey();
            List<Integer> configIndices = entry.getValue();

            Object srcValue = inputRow.getField(srcFieldIndex);
            if (srcValue == null) {
                configIndices.forEach(idx -> fieldValues[idx] = null);
                continue;
            }

            // Parse JSON once for all columns sharing the same srcField
            ReadContext readContext;
            try {
                readContext =
                        parseReadContext(
                                seaTunnelRowType.getFieldType(srcFieldIndex),
                                srcValue,
                                srcFieldIndex);
            } catch (JsonPathException e) {
                final JsonPathException ex = e;
                configIndices.forEach(idx -> fieldValues[idx] = handleJsonPathError(configs.get(idx), ex));
                continue;
            }

            // Extract values for all columns using the same ReadContext
            configIndices.forEach(
                    idx ->
                            fieldValues[idx] =
                                    doTransform(
                                            readContext, idx, configs.get(idx), converters[idx]));
        }
        return fieldValues;
    }

    /**
     * Parse source value to ReadContext. This is done once per srcField per row.
     *
     * @throws JsonPathException if JSON parsing fails
     */
    private ReadContext parseReadContext(
            SeaTunnelDataType<?> inputDataType, Object value, int srcFieldIndex) {
        String jsonString;
        switch (inputDataType.getSqlType()) {
            case STRING:
                jsonString = (String) value;
                break;
            case BYTES:
                jsonString = new String((byte[]) value);
                break;
            case ARRAY:
            case MAP:
                jsonString = JsonUtils.toJsonString(value);
                break;
            case ROW:
                SeaTunnelRow row = (SeaTunnelRow) value;
                jsonString = JsonUtils.toJsonString(row.getFields());
                break;
            default:
                throw CommonError.unsupportedDataType(
                        getPluginName(),
                        inputDataType.getSqlType().toString(),
                        seaTunnelRowType.getFieldName(srcFieldIndex));
        }
        return PARSE_CONTEXT.parse(jsonString);
    }

    /** Handle JsonPath error based on column's errorHandleWay configuration. */
    private Object handleJsonPathError(ColumnConfig columnConfig, JsonPathException e) {
        if (columnConfig.errorHandleWay() != null && columnConfig.errorHandleWay().allowSkip()) {
            log.debug("JsonPath transform error, ignore error, config: {}", columnConfig, e);
            return null;
        }
        throw new ErrorDataTransformException(
                columnConfig.errorHandleWay(),
                JSON_PATH_COMPILE_ERROR,
                String.format(
                        "JsonPath transform error, config: %s, error: %s",
                        columnConfig, e.getMessage()));
    }

    /** Extract value using pre-compiled JsonPath and convert to target type. */
    private Object doTransform(
            ReadContext readContext,
            int configIndex,
            ColumnConfig columnConfig,
            JsonToRowConverters.JsonToObjectConverter converter) {
        try {
            Object result = readContext.read(compiledPaths[configIndex]);
            if (result == null) {
                return null;
            }
            JsonNode jsonNode = JsonUtils.toJsonNode(result);
            return converter.convert(jsonNode, null);
        } catch (JsonPathException e) {
            return handleJsonPathError(columnConfig, e);
        }
    }

    @Override
    protected Column[] getOutputColumns() {
        return outputColumns;
    }
}
