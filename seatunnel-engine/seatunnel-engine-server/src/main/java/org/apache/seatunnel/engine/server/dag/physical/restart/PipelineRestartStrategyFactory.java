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

package org.apache.seatunnel.engine.server.dag.physical.restart;

import org.apache.seatunnel.api.configuration.Option;
import org.apache.seatunnel.api.options.EnvCommonOptions;

import java.util.Collections;
import java.util.Locale;
import java.util.Map;

/** Creates the {@link PipelineRestartStrategy} configured by {@code job.retry.strategy}. */
public final class PipelineRestartStrategyFactory {

    private PipelineRestartStrategyFactory() {}

    public static PipelineRestartStrategy create(Map<String, Object> envOptions) {
        Map<String, Object> options = envOptions == null ? Collections.emptyMap() : envOptions;
        String rawStrategy = stringOption(options, EnvCommonOptions.JOB_RETRY_STRATEGY);
        String strategy = rawStrategy.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        if (NoneRestartStrategy.NAME.equals(strategy)) {
            return new NoneRestartStrategy();
        }
        if (FixedDelayRestartStrategy.NAME.equals(strategy)) {
            return new FixedDelayRestartStrategy(
                    intOption(options, EnvCommonOptions.JOB_RETRY_TIMES),
                    intOption(options, EnvCommonOptions.JOB_RETRY_INTERVAL_SECONDS));
        }
        if (FailureRateRestartStrategy.NAME.equals(strategy)) {
            return new FailureRateRestartStrategy(
                    intOption(options, EnvCommonOptions.JOB_RETRY_FAILURE_RATE_MAX_FAILURES),
                    longOption(options, EnvCommonOptions.JOB_RETRY_FAILURE_RATE_INTERVAL_SECONDS),
                    longOption(options, EnvCommonOptions.JOB_RETRY_FAILURE_RATE_DELAY_SECONDS));
        }
        throw new IllegalArgumentException(
                String.format(
                        "Unsupported %s: '%s'. Supported strategies are: %s, %s, %s.",
                        EnvCommonOptions.JOB_RETRY_STRATEGY.key(),
                        rawStrategy,
                        NoneRestartStrategy.NAME,
                        FixedDelayRestartStrategy.NAME,
                        FailureRateRestartStrategy.NAME));
    }

    private static String stringOption(Map<String, Object> options, Option<String> option) {
        Object value = options.get(option.key());
        return value == null ? option.defaultValue() : value.toString();
    }

    private static int intOption(Map<String, Object> options, Option<Integer> option) {
        Object value = options.get(option.key());
        if (value == null) {
            return option.defaultValue();
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(value.toString().trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    String.format(
                            "Invalid value for %s: '%s', expected an integer.",
                            option.key(), value),
                    e);
        }
    }

    private static long longOption(Map<String, Object> options, Option<Long> option) {
        Object value = options.get(option.key());
        if (value == null) {
            return option.defaultValue();
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString().trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    String.format(
                            "Invalid value for %s: '%s', expected a long.", option.key(), value),
                    e);
        }
    }
}
