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

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Retries a fixed number of times, with a fixed delay in between.
 *
 * <p>The counter is cumulative for the lifetime of the pipeline: a successful restore does not
 * refresh it. Use {@link FailureRateRestartStrategy} when the budget should be refreshed after a
 * period of stability.
 */
public class FixedDelayRestartStrategy implements PipelineRestartStrategy {

    public static final String NAME = "fixed-delay";

    private final int maxRestartAttempts;
    private final long delaySeconds;
    private final AtomicInteger restartCount = new AtomicInteger();

    public FixedDelayRestartStrategy(int maxRestartAttempts, long delaySeconds) {
        if (maxRestartAttempts < 0) {
            throw new IllegalArgumentException(
                    "job.retry.times must be >= 0, but was " + maxRestartAttempts);
        }
        if (delaySeconds < 0) {
            throw new IllegalArgumentException(
                    "job.retry.interval.seconds must be >= 0, but was " + delaySeconds);
        }
        this.maxRestartAttempts = maxRestartAttempts;
        this.delaySeconds = delaySeconds;
    }

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public boolean canRestart() {
        return restartCount.get() < maxRestartAttempts;
    }

    @Override
    public void notifyRestart() {
        restartCount.incrementAndGet();
    }

    @Override
    public int getRestartCount() {
        return restartCount.get();
    }

    @Override
    public int getMaxRestartCount() {
        return maxRestartAttempts;
    }

    @Override
    public long getDelaySeconds() {
        return delaySeconds;
    }
}
