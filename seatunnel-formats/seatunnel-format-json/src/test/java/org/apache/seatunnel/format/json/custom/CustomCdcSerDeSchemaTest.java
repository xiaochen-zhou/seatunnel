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

import org.apache.seatunnel.api.source.Collector;
import org.apache.seatunnel.api.table.catalog.CatalogTable;
import org.apache.seatunnel.api.table.catalog.CatalogTableUtil;
import org.apache.seatunnel.api.table.type.RowKind;
import org.apache.seatunnel.api.table.type.SeaTunnelDataType;
import org.apache.seatunnel.api.table.type.SeaTunnelRow;
import org.apache.seatunnel.api.table.type.SeaTunnelRowType;
import org.apache.seatunnel.common.exception.SeaTunnelRuntimeException;

import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.apache.seatunnel.api.table.type.BasicType.FLOAT_TYPE;
import static org.apache.seatunnel.api.table.type.BasicType.INT_TYPE;
import static org.apache.seatunnel.api.table.type.BasicType.STRING_TYPE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class CustomCdcSerDeSchemaTest {

    private static final SeaTunnelRowType SEATUNNEL_ROW_TYPE =
            new SeaTunnelRowType(
                    new String[] {"id", "name", "description", "weight"},
                    new SeaTunnelDataType[] {INT_TYPE, STRING_TYPE, STRING_TYPE, FLOAT_TYPE});

    private static final CatalogTable CATALOG_TABLE =
            CatalogTableUtil.getCatalogTable("", "", "", "test", SEATUNNEL_ROW_TYPE);

    @Test
    public void testDeserializeWithValueExtractPath() throws Exception {
        List<String> lines = readLines("custom-cdc-data.txt");

        CustomCdcConfig config = new CustomCdcConfig();
        config.setOpField("eventType");
        config.setOpInsert("INSERT");
        config.setOpUpdate("UPDATE");
        config.setOpDelete("DELETE");
        config.setDataField("rowData");
        config.setDataIsArray(true);
        config.setValueExtractPath("v");
        config.setTimestampField("executeTime");
        config.setTimestampMultiplier(1000L);
        config.setDatabaseField("schema");
        config.setTableField("tableName");

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        for (String line : lines) {
            deserializationSchema.deserialize(line.getBytes(StandardCharsets.UTF_8), collector);
        }

        // Verify results
        // 3 INSERTs + 1 UPDATE (2 rows: before + after) + 1 DELETE = 6 rows
        assertEquals(7, collector.list.size());

        // Verify INSERT rows
        assertEquals(RowKind.INSERT, collector.list.get(0).getRowKind());
        assertEquals(101, collector.list.get(0).getField(0));
        assertEquals("scooter", collector.list.get(0).getField(1));
        assertEquals("Small 2-wheel scooter", collector.list.get(0).getField(2));

        assertEquals(RowKind.INSERT, collector.list.get(1).getRowKind());
        assertEquals(102, collector.list.get(1).getField(0));

        assertEquals(RowKind.INSERT, collector.list.get(2).getRowKind());
        assertEquals(103, collector.list.get(2).getField(0));

        // Verify UPDATE rows (before and after)
        assertEquals(RowKind.UPDATE_BEFORE, collector.list.get(3).getRowKind());
        assertEquals(101, collector.list.get(3).getField(0));
        assertEquals("Big 2-wheel scooter", collector.list.get(3).getField(2));

        assertEquals(RowKind.UPDATE_AFTER, collector.list.get(4).getRowKind());
        assertEquals(101, collector.list.get(4).getField(0));
        assertEquals("Big 2-wheel scooter", collector.list.get(4).getField(2));

        // Verify DELETE row
        assertEquals(RowKind.DELETE, collector.list.get(5).getRowKind());
        assertEquals(102, collector.list.get(5).getField(0));

        // Verify tableId
        assertTrue(collector.list.get(0).getTableId().contains("mydb"));
        assertTrue(collector.list.get(0).getTableId().contains("product"));
    }

    @Test
    public void testDeserializeWithoutValueExtractPath() throws Exception {
        // Test standard format without nested value structure
        String json =
                "{\"type\":\"INSERT\",\"data\":[{\"id\":101,\"name\":\"scooter\",\"description\":\"Small scooter\",\"weight\":3.14}]}";

        CustomCdcConfig config = new CustomCdcConfig();
        // Use default values

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        deserializationSchema.deserialize(json.getBytes(StandardCharsets.UTF_8), collector);

        assertEquals(1, collector.list.size());
        assertEquals(RowKind.INSERT, collector.list.get(0).getRowKind());
        assertEquals(101, collector.list.get(0).getField(0));
        assertEquals("scooter", collector.list.get(0).getField(1));
    }

    @Test
    public void testDeserializeNullMessage() throws Exception {
        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, new CustomCdcConfig());

        SimpleCollector collector = new SimpleCollector();
        deserializationSchema.deserialize((byte[]) null, collector);

        assertEquals(0, collector.list.size());
    }

    @Test
    public void testDeserializeEmptyMessage() throws Exception {
        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, new CustomCdcConfig());

        SimpleCollector collector = new SimpleCollector();
        deserializationSchema.deserialize(new byte[0], collector);

        assertEquals(0, collector.list.size());
    }

    @Test
    public void testDeserializeInvalidJson() throws Exception {
        CustomCdcConfig config = new CustomCdcConfig();
        config.setIgnoreParseErrors(false);

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        String invalidJson = "{invalid json}";

        assertThrows(
                SeaTunnelRuntimeException.class,
                () -> {
                    deserializationSchema.deserialize(
                            invalidJson.getBytes(StandardCharsets.UTF_8), collector);
                });
    }

    @Test
    public void testDeserializeInvalidJsonWithIgnoreErrors() throws Exception {
        CustomCdcConfig config = new CustomCdcConfig();
        config.setIgnoreParseErrors(true);

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        String invalidJson = "{invalid json}";

        // Should not throw exception
        deserializationSchema.deserialize(invalidJson.getBytes(StandardCharsets.UTF_8), collector);
        assertEquals(0, collector.list.size());
    }

    @Test
    public void testDeserializeUnknownOperationType() throws Exception {
        CustomCdcConfig config = new CustomCdcConfig();
        config.setIgnoreParseErrors(false);

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        String unknownOpJson = "{\"type\":\"UNKNOWN\",\"data\":[{\"id\":101}]}";

        assertThrows(
                SeaTunnelRuntimeException.class,
                () -> {
                    deserializationSchema.deserialize(
                            unknownOpJson.getBytes(StandardCharsets.UTF_8), collector);
                });
    }

    @Test
    public void testDeserializeMissingOpField() throws Exception {
        CustomCdcConfig config = new CustomCdcConfig();
        config.setIgnoreParseErrors(false);

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        String missingOpJson = "{\"data\":[{\"id\":101}]}";

        assertThrows(
                SeaTunnelRuntimeException.class,
                () -> {
                    deserializationSchema.deserialize(
                            missingOpJson.getBytes(StandardCharsets.UTF_8), collector);
                });
    }

    @Test
    public void testDeserializeMissingDataField() throws Exception {
        CustomCdcConfig config = new CustomCdcConfig();

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        String missingDataJson = "{\"type\":\"INSERT\"}";

        // Should not throw, just skip
        deserializationSchema.deserialize(
                missingDataJson.getBytes(StandardCharsets.UTF_8), collector);
        assertEquals(0, collector.list.size());
    }

    @Test
    public void testDeserializeSingleDataObject() throws Exception {
        // Test with dataIsArray = false
        String json =
                "{\"type\":\"INSERT\",\"data\":{\"id\":101,\"name\":\"scooter\",\"description\":\"Small scooter\",\"weight\":3.14}}";

        CustomCdcConfig config = new CustomCdcConfig();
        config.setDataIsArray(false);

        CustomCdcDeserializationSchema deserializationSchema =
                new CustomCdcDeserializationSchema(CATALOG_TABLE, config);

        SimpleCollector collector = new SimpleCollector();
        deserializationSchema.deserialize(json.getBytes(StandardCharsets.UTF_8), collector);

        assertEquals(1, collector.list.size());
        assertEquals(RowKind.INSERT, collector.list.get(0).getRowKind());
        assertEquals(101, collector.list.get(0).getField(0));
    }

    @Test
    public void testBuilderPattern() throws Exception {
        CustomCdcDeserializationSchema deserializationSchema =
                CustomCdcDeserializationSchema.builder(CATALOG_TABLE)
                        .setOpField("eventType")
                        .setOpInsert("INSERT")
                        .setOpUpdate("UPDATE")
                        .setOpDelete("DELETE")
                        .setDataField("rowData")
                        .setDataIsArray(true)
                        .setValueExtractPath("v")
                        .setTimestampField("executeTime")
                        .setTimestampMultiplier(1000L)
                        .setDatabaseField("schema")
                        .setTableField("tableName")
                        .setIgnoreParseErrors(false)
                        .build();

        String json =
                "{\"eventType\":\"INSERT\",\"executeTime\":1598944146,\"schema\":\"mydb\",\"tableName\":\"product\",\"rowData\":[{\"id\":{\"u\":true,\"v\":\"101\"},\"name\":{\"u\":true,\"v\":\"test\"}}]}";

        SimpleCollector collector = new SimpleCollector();
        deserializationSchema.deserialize(json.getBytes(StandardCharsets.UTF_8), collector);

        assertEquals(1, collector.list.size());
        assertEquals(RowKind.INSERT, collector.list.get(0).getRowKind());
    }

    // --------------------------------------------------------------------------------------------
    // Utilities
    // --------------------------------------------------------------------------------------------

    private static List<String> readLines(String resource) throws IOException {
        final URL url = CustomCdcSerDeSchemaTest.class.getClassLoader().getResource(resource);
        assert url != null;
        Path path = new File(url.getFile()).toPath();
        return Files.readAllLines(path);
    }

    private static class SimpleCollector implements Collector<SeaTunnelRow> {

        private List<SeaTunnelRow> list = new ArrayList<>();

        @Override
        public void collect(SeaTunnelRow record) {
            list.add(record);
        }

        @Override
        public Object getCheckpointLock() {
            return null;
        }
    }
}
