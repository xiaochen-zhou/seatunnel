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

import org.apache.seatunnel.api.options.EnvCommonOptions;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

public class PipelineRestartStrategyFactoryTest {

    @Test
    public void testDefaultsToFixedDelayForLegacyConfigs() {
        PipelineRestartStrategy strategy = PipelineRestartStrategyFactory.create(null);

        Assertions.assertEquals(FixedDelayRestartStrategy.NAME, strategy.getName());
        Assertions.assertEquals(
                EnvCommonOptions.JOB_RETRY_TIMES.defaultValue(), strategy.getMaxRestartCount());
        Assertions.assertEquals(
                EnvCommonOptions.JOB_RETRY_INTERVAL_SECONDS.defaultValue().longValue(),
                strategy.getDelaySeconds());
        Assertions.assertEquals(0, strategy.getRestartCount());
    }

    @Test
    public void testFixedDelayReadsLegacyOptions() {
        Map<String, Object> options = new HashMap<>();
        options.put(EnvCommonOptions.JOB_RETRY_STRATEGY.key(), "fixed-delay");
        options.put(EnvCommonOptions.JOB_RETRY_TIMES.key(), "5");
        options.put(EnvCommonOptions.JOB_RETRY_INTERVAL_SECONDS.key(), 7);

        PipelineRestartStrategy strategy = PipelineRestartStrategyFactory.create(options);

        Assertions.assertEquals(5, strategy.getMaxRestartCount());
        Assertions.assertEquals(7, strategy.getDelaySeconds());
    }

    @Test
    public void testNoneStrategy() {
        Map<String, Object> options = new HashMap<>();
        options.put(EnvCommonOptions.JOB_RETRY_STRATEGY.key(), "NONE");

        PipelineRestartStrategy strategy = PipelineRestartStrategyFactory.create(options);

        Assertions.assertEquals(NoneRestartStrategy.NAME, strategy.getName());
        Assertions.assertFalse(strategy.canRestart());
        Assertions.assertEquals(0, strategy.getMaxRestartCount());
    }

    @Test
    public void testFailureRateStrategyNormalizesNameAndReadsOptions() {
        Map<String, Object> options = new HashMap<>();
        options.put(EnvCommonOptions.JOB_RETRY_STRATEGY.key(), " failure_rate ");
        options.put(EnvCommonOptions.JOB_RETRY_FAILURE_RATE_MAX_FAILURES.key(), "4");
        options.put(EnvCommonOptions.JOB_RETRY_FAILURE_RATE_INTERVAL_SECONDS.key(), "120");
        options.put(EnvCommonOptions.JOB_RETRY_FAILURE_RATE_DELAY_SECONDS.key(), "9");

        PipelineRestartStrategy strategy = PipelineRestartStrategyFactory.create(options);

        Assertions.assertEquals(FailureRateRestartStrategy.NAME, strategy.getName());
        Assertions.assertEquals(4, strategy.getMaxRestartCount());
        Assertions.assertEquals(9, strategy.getDelaySeconds());
    }

    @Test
    public void testUnknownStrategyIsRejected() {
        Map<String, Object> options = new HashMap<>();
        options.put(EnvCommonOptions.JOB_RETRY_STRATEGY.key(), "exponential-delay");

        IllegalArgumentException exception =
                Assertions.assertThrows(
                        IllegalArgumentException.class,
                        () -> PipelineRestartStrategyFactory.create(options));
        Assertions.assertTrue(exception.getMessage().contains("Unsupported job.retry.strategy"));
    }

    @Test
    public void testInvalidNumberIsRejected() {
        Map<String, Object> options = new HashMap<>();
        options.put(EnvCommonOptions.JOB_RETRY_STRATEGY.key(), "fixed-delay");
        options.put(EnvCommonOptions.JOB_RETRY_TIMES.key(), "not-a-number");

        IllegalArgumentException exception =
                Assertions.assertThrows(
                        IllegalArgumentException.class,
                        () -> PipelineRestartStrategyFactory.create(options));
        Assertions.assertTrue(exception.getMessage().contains("job.retry.times"));
    }
}
