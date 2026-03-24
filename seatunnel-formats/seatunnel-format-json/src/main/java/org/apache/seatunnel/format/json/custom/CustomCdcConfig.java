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

import lombok.Data;

import java.io.Serializable;

/**
 * Configuration for custom CDC JSON format.
 *
 * <p>This allows users to define their own CDC format mapping through configuration without
 * implementing custom deserialization code.
 */
@Data
public class CustomCdcConfig implements Serializable {
    private static final long serialVersionUID = 1L;

    /** The field name containing operation type (e.g., "eventType", "type", "op"). */
    private String opField = "type";

    /** The value representing INSERT operation. */
    private String opInsert = "INSERT";

    /** The value representing UPDATE operation. */
    private String opUpdate = "UPDATE";

    /** The value representing DELETE operation. */
    private String opDelete = "DELETE";

    /** The field name containing row data (e.g., "data", "rowData"). */
    private String dataField = "data";

    /** Whether the data field is an array. */
    private boolean dataIsArray = true;

    /**
     * Path to extract value from nested field structure.
     *
     * <p>For example, if your data format is: {"id": {"u": true, "v": 123}}, set this to "v" to
     * extract the actual value.
     */
    private String valueExtractPath;

    /** The field name containing old data for UPDATE (before image). */
    private String oldDataField;

    /** The field name containing timestamp. */
    private String timestampField;

    /** Multiplier for timestamp (e.g., 1000 to convert seconds to milliseconds). */
    private long timestampMultiplier = 1L;

    /** The field name containing database name. */
    private String databaseField;

    /** The field name containing table name. */
    private String tableField;

    /** Whether to ignore parse errors. */
    private boolean ignoreParseErrors = false;
}
