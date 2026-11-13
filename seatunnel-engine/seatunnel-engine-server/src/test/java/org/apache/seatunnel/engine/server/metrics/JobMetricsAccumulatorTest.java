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

package org.apache.seatunnel.engine.server.metrics;

import org.apache.seatunnel.api.common.metrics.JobMetrics;
import org.apache.seatunnel.api.common.metrics.Measurement;
import org.apache.seatunnel.api.common.metrics.MetricTags;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

class JobMetricsAccumulatorTest {

    private static final String SOURCE_RECEIVED_COUNT = "SourceReceivedCount";
    private static final String SOURCE_RECEIVED_QPS = "SourceReceivedQPS";

    @Test
    void testCounterValuesAreSummedAcrossAttempts() {
        JobMetrics previous =
                metricsOf(SOURCE_RECEIVED_COUNT, 100L, tableTags("PAY.TRADE_RECEIPT_INFO"));
        JobMetrics current =
                metricsOf(SOURCE_RECEIVED_COUNT, 250L, tableTags("PAY.TRADE_RECEIPT_INFO"));

        JobMetrics result = JobMetricsAccumulator.accumulate(previous, current);

        Assertions.assertEquals(
                350L,
                singleValue(result, SOURCE_RECEIVED_COUNT, tableTags("PAY.TRADE_RECEIPT_INFO")));
    }

    @Test
    void testSnapshotValuesKeepTheLatestAttempt() {
        JobMetrics previous = metricsOf(SOURCE_RECEIVED_QPS, 1200.5D, tableTags("PAY.A"));
        JobMetrics current = metricsOf(SOURCE_RECEIVED_QPS, 30.0D, tableTags("PAY.A"));

        JobMetrics result = JobMetricsAccumulator.accumulate(previous, current);

        Assertions.assertEquals(
                30.0D, singleValue(result, SOURCE_RECEIVED_QPS, tableTags("PAY.A")));
    }

    @Test
    void testMeasurementsOfDifferentTablesAreKept() {
        JobMetrics previous = metricsOf(SOURCE_RECEIVED_COUNT, 10L, tableTags("PAY.A"));
        JobMetrics current = metricsOf(SOURCE_RECEIVED_COUNT, 20L, tableTags("PAY.B"));

        JobMetrics result = JobMetricsAccumulator.accumulate(previous, current);

        List<Measurement> measurements = result.getMetrics().get(SOURCE_RECEIVED_COUNT);
        Assertions.assertEquals(2, measurements.size());
        Assertions.assertEquals(10L, valueOf(measurements, tableTags("PAY.A")));
        Assertions.assertEquals(20L, valueOf(measurements, tableTags("PAY.B")));
    }

    @Test
    void testMemberAndAddressTagsAreIgnoredWhenMatching() {
        Map<String, String> previousTags = tableTags("PAY.A");
        previousTags.put(MetricTags.MEMBER, "member-1");
        previousTags.put(MetricTags.ADDRESS, "10.0.0.1:5801");
        Map<String, String> currentTags = tableTags("PAY.A");
        currentTags.put(MetricTags.MEMBER, "member-2");
        currentTags.put(MetricTags.ADDRESS, "10.0.0.2:5801");

        JobMetrics result =
                JobMetricsAccumulator.accumulate(
                        metricsOf(SOURCE_RECEIVED_COUNT, 5L, previousTags),
                        metricsOf(SOURCE_RECEIVED_COUNT, 7L, currentTags));

        Assertions.assertEquals(1, result.getMetrics().get(SOURCE_RECEIVED_COUNT).size());
        Assertions.assertEquals(12L, result.getMetrics().get(SOURCE_RECEIVED_COUNT).get(0).value());
    }

    @Test
    void testEmptyInputs() {
        JobMetrics metrics = metricsOf(SOURCE_RECEIVED_COUNT, 5L, tableTags("PAY.A"));

        Assertions.assertTrue(JobMetricsAccumulator.accumulate(null, null).getMetrics().isEmpty());
        Assertions.assertSame(metrics, JobMetricsAccumulator.accumulate(metrics, null));
        Assertions.assertSame(metrics, JobMetricsAccumulator.accumulate(null, metrics));
        Assertions.assertSame(
                metrics, JobMetricsAccumulator.accumulate(JobMetrics.empty(), metrics));
    }

    private static JobMetrics metricsOf(String metric, Object value, Map<String, String> tags) {
        Measurement measurement = Measurement.of(metric, value, 1L, tags);
        List<Measurement> measurements = new ArrayList<>();
        measurements.add(measurement);
        Map<String, List<Measurement>> metrics = new HashMap<>();
        metrics.put(metric, measurements);
        return JobMetrics.of(metrics);
    }

    private static Map<String, String> tableTags(String table) {
        Map<String, String> tags = new HashMap<>();
        tags.put("table", table);
        return tags;
    }

    private static Object valueOf(List<Measurement> measurements, Map<String, String> tags) {
        return measurements.stream()
                .filter(measurement -> tags.equals(measurement.getTags()))
                .findFirst()
                .map(Measurement::value)
                .orElse(null);
    }

    private static Object singleValue(JobMetrics metrics, String metric, Map<String, String> tags) {
        List<Measurement> measurements =
                metrics.getMetrics().getOrDefault(metric, Collections.emptyList());
        Assertions.assertEquals(1, measurements.size());
        Assertions.assertEquals(tags, measurements.get(0).getTags());
        return measurements.get(0).value();
    }
}
