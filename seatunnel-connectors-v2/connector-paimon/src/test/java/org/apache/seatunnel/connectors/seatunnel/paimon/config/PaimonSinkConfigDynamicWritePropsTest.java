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

package org.apache.seatunnel.connectors.seatunnel.paimon.config;

import org.apache.paimon.CoreOptions;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

class PaimonSinkConfigDynamicWritePropsTest {

    @Test
    void testOnlyRuntimeTunableOptionsAreKept() {
        Map<String, String> writeProps = new HashMap<>();
        writeProps.put(CoreOptions.NUM_SORTED_RUNS_COMPACTION_TRIGGER.key(), "32");
        writeProps.put(CoreOptions.NUM_SORTED_RUNS_STOP_TRIGGER.key(), "40");
        writeProps.put(CoreOptions.COMPACTION_MAX_SIZE_AMPLIFICATION_PERCENT.key(), "300");
        writeProps.put(CoreOptions.WRITE_BUFFER_SIZE.key(), "256mb");
        writeProps.put(CoreOptions.COMMIT_FORCE_COMPACT.key(), "false");

        // physical layout options must never be applied on an existing table
        writeProps.put("bucket", "12");
        writeProps.put("bucket-key", "id");
        writeProps.put("partition", "dt");
        writeProps.put("file.format", "parquet");
        writeProps.put("primary-key", "id");

        Map<String, String> dynamic = PaimonSinkConfig.filterDynamicWriteProps(writeProps);

        Assertions.assertEquals(5, dynamic.size());
        Assertions.assertEquals("32", dynamic.get("num-sorted-run.compaction-trigger"));
        Assertions.assertEquals("40", dynamic.get("num-sorted-run.stop-trigger"));
        Assertions.assertEquals("300", dynamic.get("compaction.max-size-amplification-percent"));
        Assertions.assertEquals("256mb", dynamic.get("write-buffer-size"));
        Assertions.assertEquals("false", dynamic.get("commit.force-compact"));
        Assertions.assertFalse(dynamic.containsKey("bucket"));
        Assertions.assertFalse(dynamic.containsKey("bucket-key"));
        Assertions.assertFalse(dynamic.containsKey("partition"));
        Assertions.assertFalse(dynamic.containsKey("file.format"));
        Assertions.assertFalse(dynamic.containsKey("primary-key"));
    }

    @Test
    void testReturnsEmptyWhenNothingIsTunable() {
        Map<String, String> writeProps = new HashMap<>();
        writeProps.put("bucket", "12");
        writeProps.put("file.format", "orc");

        Assertions.assertTrue(PaimonSinkConfig.filterDynamicWriteProps(writeProps).isEmpty());
        Assertions.assertTrue(PaimonSinkConfig.filterDynamicWriteProps(null).isEmpty());
    }

    @Test
    void testBlankKeysAndNullValuesAreIgnored() {
        Map<String, String> writeProps = new HashMap<>();
        writeProps.put(" num-sorted-run.compaction-trigger ", "16");
        writeProps.put(CoreOptions.WRITE_ONLY.key(), null);

        Map<String, String> dynamic = PaimonSinkConfig.filterDynamicWriteProps(writeProps);

        Assertions.assertEquals(1, dynamic.size());
        Assertions.assertEquals("16", dynamic.get("num-sorted-run.compaction-trigger"));
    }
}
