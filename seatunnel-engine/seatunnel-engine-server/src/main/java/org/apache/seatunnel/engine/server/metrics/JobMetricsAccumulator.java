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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Accumulates the metrics of multiple pipeline attempts of the same job.
 *
 * <p>A pipeline that fails and is restored starts a new attempt whose task locations are identical
 * to the failed one. The engine therefore clears the metrics of the failed attempt before the
 * restore to avoid mixing the two attempts. Without accumulation the finished job would only report
 * the data processed by the last attempt, which makes a job that read millions of rows look like it
 * read nothing when the final attempt failed early or stayed idle.
 *
 * <p>Counter metrics (values stored as {@link Long}, for example {@code SourceReceivedCount}) are
 * summed across attempts. Snapshot metrics (values stored as {@link Double}, for example {@code
 * SourceReceivedQPS}) are not additive, so the latest value wins.
 */
public final class JobMetricsAccumulator {

    private static final Set<String> TAGS_TO_IGNORE =
            new HashSet<>(Arrays.asList(MetricTags.MEMBER, MetricTags.ADDRESS));

    private JobMetricsAccumulator() {}

    /**
     * Adds the measurements of {@code current} to {@code previous}.
     *
     * @param previous measurements of the earlier attempts, may be {@code null}
     * @param current measurements of the latest attempt, may be {@code null}
     * @return the accumulated metrics, never {@code null}
     */
    public static JobMetrics accumulate(JobMetrics previous, JobMetrics current) {
        boolean noPrevious = previous == null || previous.getMetrics().isEmpty();
        boolean noCurrent = current == null || current.getMetrics().isEmpty();
        if (noPrevious && noCurrent) {
            return JobMetrics.empty();
        }
        if (noPrevious) {
            return current;
        }
        if (noCurrent) {
            return previous;
        }

        Map<String, List<Measurement>> merged = new HashMap<>();
        previous.getMetrics()
                .forEach(
                        (metric, measurements) ->
                                merged.put(metric, new ArrayList<>(measurements)));
        current.getMetrics()
                .forEach(
                        (metric, measurements) -> {
                            List<Measurement> existing = merged.get(metric);
                            if (existing == null) {
                                merged.put(metric, new ArrayList<>(measurements));
                                return;
                            }
                            for (Measurement measurement : measurements) {
                                int index = indexOfSameTags(existing, measurement);
                                if (index < 0) {
                                    existing.add(measurement);
                                } else {
                                    existing.set(index, add(existing.get(index), measurement));
                                }
                            }
                        });
        return JobMetrics.of(merged);
    }

    private static int indexOfSameTags(List<Measurement> measurements, Measurement target) {
        for (int i = 0; i < measurements.size(); i++) {
            if (JobMetrics.areMapsEqualExcludingKeys(
                    measurements.get(i).getTags(), target.getTags(), TAGS_TO_IGNORE)) {
                return i;
            }
        }
        return -1;
    }

    private static Measurement add(Measurement previous, Measurement current) {
        Object previousValue = previous.value();
        Object currentValue = current.value();
        Object value = currentValue;
        if (previousValue instanceof Long && currentValue instanceof Long) {
            value = (Long) previousValue + (Long) currentValue;
        }
        return Measurement.of(
                current.getMetric(),
                value,
                Math.max(previous.getTimestamp(), current.getTimestamp()),
                current.getTags());
    }
}
