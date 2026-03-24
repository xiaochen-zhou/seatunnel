/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.seatunnel.format.json.custom;

import org.apache.seatunnel.shade.com.fasterxml.jackson.core.json.JsonReadFeature;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.DeserializationFeature;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.JsonNode;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.node.ArrayNode;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.node.ObjectNode;

import org.apache.seatunnel.api.serialization.DeserializationSchema;
import org.apache.seatunnel.api.source.Collector;
import org.apache.seatunnel.api.table.catalog.CatalogTable;
import org.apache.seatunnel.api.table.catalog.TablePath;
import org.apache.seatunnel.api.table.type.MetadataUtil;
import org.apache.seatunnel.api.table.type.RowKind;
import org.apache.seatunnel.api.table.type.SeaTunnelDataType;
import org.apache.seatunnel.api.table.type.SeaTunnelRow;
import org.apache.seatunnel.api.table.type.SeaTunnelRowType;
import org.apache.seatunnel.common.exception.CommonError;
import org.apache.seatunnel.format.json.JsonDeserializationSchema;

import lombok.NonNull;

import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.Optional;

/**
 * Deserialization schema for custom CDC JSON format.
 *
 * <p>This schema allows users to parse custom CDC format data by configuring field mappings,
 * without implementing custom deserialization code.
 *
 * <p>Example configuration:
 *
 * <pre>{@code
 * custom: {
 *   opField: "eventType"
 *   opInsert: "INSERT"
 *   opUpdate: "UPDATE"
 *   opDelete: "DELETE"
 *   dataField: "rowData"
 *   dataIsArray: true
 *   valueExtractPath: "v"
 *   timestampField: "executeTime"
 *   timestampMultiplier: 1000
 *   databaseField: "schema"
 *   tableField: "tableName"
 * }
 * }</pre>
 */
public class CustomCdcDeserializationSchema implements DeserializationSchema<SeaTunnelRow> {
    private static final long serialVersionUID = 1L;

    private static final String FORMAT = "Custom";

    private final CustomCdcConfig config;
    private final CatalogTable catalogTable;
    private final SeaTunnelRowType rowType;
    private final JsonDeserializationSchema jsonDeserializer;
    private final ObjectMapper objectMapper;

    public CustomCdcDeserializationSchema(
            @NonNull CatalogTable catalogTable, @NonNull CustomCdcConfig config) {
        this.catalogTable = catalogTable;
        this.rowType = catalogTable.getSeaTunnelRowType();
        this.config = config;
        this.jsonDeserializer =
                new JsonDeserializationSchema(catalogTable, false, config.isIgnoreParseErrors());
        this.objectMapper = new ObjectMapper();
        this.objectMapper.enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
        this.objectMapper.configure(
                JsonReadFeature.ALLOW_UNESCAPED_CONTROL_CHARS.mappedFeature(), true);
    }

    @Override
    public SeaTunnelRow deserialize(byte[] message) throws IOException {
        throw new UnsupportedOperationException(
                "Please invoke DeserializationSchema#deserialize(byte[], Collector<SeaTunnelRow>) instead.");
    }

    @Override
    public void deserialize(byte[] message, Collector<SeaTunnelRow> out) throws IOException {
        if (message == null || message.length == 0) {
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(message);
            deserialize(root, out);
        } catch (Exception e) {
            if (!config.isIgnoreParseErrors()) {
                throw CommonError.jsonOperationError(FORMAT, new String(message), e);
            }
        }
    }

    public void deserialize(JsonNode root, Collector<SeaTunnelRow> out) throws IOException {
        Optional<TablePath> tablePath =
                Optional.ofNullable(catalogTable).map(CatalogTable::getTablePath);

        try {
            // 1. Get operation type
            JsonNode opNode = root.get(config.getOpField());
            if (opNode == null || opNode.isNull()) {
                if (!config.isIgnoreParseErrors()) {
                    throw new IllegalStateException(
                            String.format(
                                    "Operation field '%s' not found in message",
                                    config.getOpField()));
                }
                return;
            }
            String opType = opNode.asText();

            // 2. Get timestamp
            Long timestamp = null;
            if (config.getTimestampField() != null && !config.getTimestampField().isEmpty()) {
                JsonNode tsNode = root.get(config.getTimestampField());
                if (tsNode != null && !tsNode.isNull()) {
                    timestamp = tsNode.asLong() * config.getTimestampMultiplier();
                }
            }

            // 3. Build tableId
            String tableId = buildTableId(root, tablePath);

            // 4. Get data node
            JsonNode dataNode = root.get(config.getDataField());
            if (dataNode == null || dataNode.isNull()) {
                // Skip if no data
                return;
            }

            // 5. Get old data node (for UPDATE)
            JsonNode oldDataNode = null;
            if (config.getOldDataField() != null && !config.getOldDataField().isEmpty()) {
                oldDataNode = root.get(config.getOldDataField());
            }

            // 6. Process data (array or single)
            if (config.isDataIsArray() && dataNode.isArray()) {
                ArrayNode dataArray = (ArrayNode) dataNode;
                ArrayNode oldArray =
                        (oldDataNode != null && oldDataNode.isArray())
                                ? (ArrayNode) oldDataNode
                                : null;

                for (int i = 0; i < dataArray.size(); i++) {
                    JsonNode oldRow =
                            (oldArray != null && i < oldArray.size()) ? oldArray.get(i) : null;
                    processRow(dataArray.get(i), oldRow, opType, timestamp, tableId, out);
                }
            } else {
                processRow(dataNode, oldDataNode, opType, timestamp, tableId, out);
            }

        } catch (RuntimeException e) {
            if (!config.isIgnoreParseErrors()) {
                throw CommonError.jsonOperationError(FORMAT, root.toString(), e);
            }
        }
    }

    private void processRow(
            JsonNode rowNode,
            JsonNode oldRowNode,
            String opType,
            Long timestamp,
            String tableId,
            Collector<SeaTunnelRow> out) {

        // Extract field values (handle {field: {u, v}} format)
        ObjectNode dataNode = extractValues(rowNode);
        ObjectNode oldNode = oldRowNode != null ? extractValues(oldRowNode) : null;

        if (config.getOpInsert().equalsIgnoreCase(opType)) {
            // INSERT
            SeaTunnelRow row = jsonDeserializer.convertToRowData(dataNode);
            row.setRowKind(RowKind.INSERT);
            setMetadata(row, timestamp, tableId);
            out.collect(row);

        } else if (config.getOpUpdate().equalsIgnoreCase(opType)) {
            // UPDATE: output before and after
            SeaTunnelRow before;
            if (oldNode != null) {
                // If old data exists, use it; fill missing fields from new data
                for (String fieldName : rowType.getFieldNames()) {
                    if (!oldNode.has(fieldName) || oldNode.get(fieldName).isNull()) {
                        if (dataNode.has(fieldName)) {
                            oldNode.set(fieldName, dataNode.get(fieldName));
                        }
                    }
                }
                before = jsonDeserializer.convertToRowData(oldNode);
            } else {
                // If no old data, use current data as before
                before = jsonDeserializer.convertToRowData(dataNode);
            }
            before.setRowKind(RowKind.UPDATE_BEFORE);
            setMetadata(before, timestamp, tableId);
            out.collect(before);

            SeaTunnelRow after = jsonDeserializer.convertToRowData(dataNode);
            after.setRowKind(RowKind.UPDATE_AFTER);
            setMetadata(after, timestamp, tableId);
            out.collect(after);

        } else if (config.getOpDelete().equalsIgnoreCase(opType)) {
            // DELETE
            SeaTunnelRow row = jsonDeserializer.convertToRowData(dataNode);
            row.setRowKind(RowKind.DELETE);
            setMetadata(row, timestamp, tableId);
            out.collect(row);

        } else {
            if (!config.isIgnoreParseErrors()) {
                throw new IllegalStateException(
                        String.format("Unknown operation type '%s'.", opType));
            }
        }
    }

    /**
     * Extract values from nested field structure.
     *
     * <p>For example, if valueExtractPath is "v", transform: {"id": {"u": true, "v": 123}} to:
     * {"id": 123}
     */
    private ObjectNode extractValues(JsonNode rowNode) {
        // If no valueExtractPath configured, return original node
        if (config.getValueExtractPath() == null || config.getValueExtractPath().isEmpty()) {
            if (rowNode.isObject()) {
                return (ObjectNode) rowNode;
            }
            return objectMapper.createObjectNode();
        }

        ObjectNode result = objectMapper.createObjectNode();
        Iterator<Map.Entry<String, JsonNode>> fields = rowNode.fields();

        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String fieldName = entry.getKey();
            JsonNode fieldNode = entry.getValue();

            // Extract value from nested structure
            if (fieldNode.isObject() && fieldNode.has(config.getValueExtractPath())) {
                result.set(fieldName, fieldNode.get(config.getValueExtractPath()));
            } else {
                // If not nested structure, use original value
                result.set(fieldName, fieldNode);
            }
        }
        return result;
    }

    private String buildTableId(JsonNode root, Optional<TablePath> tablePath) {
        // First try to use configured database/table fields
        StringBuilder sb = new StringBuilder();

        if (config.getDatabaseField() != null && !config.getDatabaseField().isEmpty()) {
            JsonNode dbNode = root.get(config.getDatabaseField());
            if (dbNode != null && !dbNode.isNull()) {
                sb.append(dbNode.asText());
            }
        }

        if (config.getTableField() != null && !config.getTableField().isEmpty()) {
            JsonNode tableNode = root.get(config.getTableField());
            if (tableNode != null && !tableNode.isNull()) {
                if (sb.length() > 0) {
                    sb.append(".");
                }
                sb.append(tableNode.asText());
            }
        }

        if (sb.length() > 0) {
            return sb.toString();
        }

        // Fall back to catalog table path
        return tablePath.map(TablePath::toString).orElse(null);
    }

    private void setMetadata(SeaTunnelRow row, Long timestamp, String tableId) {
        if (timestamp != null) {
            MetadataUtil.setEventTime(row, timestamp);
        }
        if (tableId != null && !tableId.isEmpty()) {
            row.setTableId(tableId);
        }
    }

    @Override
    public SeaTunnelDataType<SeaTunnelRow> getProducedType() {
        return rowType;
    }

    // --------------------------------------------------------------------------------------------
    // Builder
    // --------------------------------------------------------------------------------------------

    public static Builder builder(CatalogTable catalogTable) {
        return new Builder(catalogTable);
    }

    public static class Builder {
        private CatalogTable catalogTable;
        private CustomCdcConfig config = new CustomCdcConfig();

        public Builder(CatalogTable catalogTable) {
            this.catalogTable = catalogTable;
        }

        public Builder setConfig(CustomCdcConfig config) {
            this.config = config;
            return this;
        }

        public Builder setOpField(String opField) {
            this.config.setOpField(opField);
            return this;
        }

        public Builder setOpInsert(String opInsert) {
            this.config.setOpInsert(opInsert);
            return this;
        }

        public Builder setOpUpdate(String opUpdate) {
            this.config.setOpUpdate(opUpdate);
            return this;
        }

        public Builder setOpDelete(String opDelete) {
            this.config.setOpDelete(opDelete);
            return this;
        }

        public Builder setDataField(String dataField) {
            this.config.setDataField(dataField);
            return this;
        }

        public Builder setDataIsArray(boolean dataIsArray) {
            this.config.setDataIsArray(dataIsArray);
            return this;
        }

        public Builder setValueExtractPath(String valueExtractPath) {
            this.config.setValueExtractPath(valueExtractPath);
            return this;
        }

        public Builder setOldDataField(String oldDataField) {
            this.config.setOldDataField(oldDataField);
            return this;
        }

        public Builder setTimestampField(String timestampField) {
            this.config.setTimestampField(timestampField);
            return this;
        }

        public Builder setTimestampMultiplier(long timestampMultiplier) {
            this.config.setTimestampMultiplier(timestampMultiplier);
            return this;
        }

        public Builder setDatabaseField(String databaseField) {
            this.config.setDatabaseField(databaseField);
            return this;
        }

        public Builder setTableField(String tableField) {
            this.config.setTableField(tableField);
            return this;
        }

        public Builder setIgnoreParseErrors(boolean ignoreParseErrors) {
            this.config.setIgnoreParseErrors(ignoreParseErrors);
            return this;
        }

        public CustomCdcDeserializationSchema build() {
            return new CustomCdcDeserializationSchema(catalogTable, config);
        }
    }
}
