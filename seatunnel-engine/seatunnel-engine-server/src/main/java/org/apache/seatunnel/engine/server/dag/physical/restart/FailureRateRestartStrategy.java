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

import org.apache.seatunnel.shade.com.google.common.annotations.VisibleForTesting;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

/**
 * Restarts a failed pipeline while the number of failures inside a sliding window stays below the
 * configured limit.
 *
 * <p>Failures leave the window after {@code job.retry.failure-rate.interval.seconds} seconds, so a
 * pipeline that stays healthy for that long starts with a fresh retry budget. This is the
 * difference from {@link FixedDelayRestartStrategy}, whose budget is consumed for the whole
 * lifetime of the pipeline.
 */
public class FailureRateRestartStrategy implements PipelineRestartStrategy {

    public static final String NAME = "failure-rate";

    private final int maxFailuresPerInterval;
    private final long intervalSeconds;
    private final long delaySeconds;
    private final LongSupplier clock;
    private final Deque<Long> failureTimestamps = new ArrayDeque<>();
    private int restartCount;

    public FailureRateRestartStrategy(
            int maxFailuresPerInterval, long intervalSeconds, long delaySeconds) {
        this(maxFailuresPerInterval, intervalSeconds, delaySeconds, System::currentTimeMillis);
    }

    @VisibleForTesting
    FailureRateRestartStrategy(
            int maxFailuresPerInterval,
            long intervalSeconds,
            long delaySeconds,
            LongSupplier clock) {
        if (maxFailuresPerInterval < 0) {
            throw new IllegalArgumentException(
                    "job.retry.failure-rate.max-failures-per-interval must be >= 0, but was "
                            + maxFailuresPerInterval);
        }
        if (intervalSeconds <= 0) {
            throw new IllegalArgumentException(
                    "job.retry.failure-rate.interval.seconds must be > 0, but was "
                            + intervalSeconds);
        }
        if (delaySeconds < 0) {
            throw new IllegalArgumentException(
                    "job.retry.failure-rate.delay.seconds must be >= 0, but was " + delaySeconds);
        }
        this.maxFailuresPerInterval = maxFailuresPerInterval;
        this.intervalSeconds = intervalSeconds;
        this.delaySeconds = delaySeconds;
        this.clock = clock;
    }

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public synchronized boolean canRestart() {
        pruneExpired(clock.getAsLong());
        return failureTimestamps.size() < maxFailuresPerInterval;
    }

    @Override
    public synchronized void notifyRestart() {
        long now = clock.getAsLong();
        pruneExpired(now);
        failureTimestamps.addLast(now);
        restartCount++;
    }

    @Override
    public synchronized int getRestartCount() {
        return restartCount;
    }

    @Override
    public int getMaxRestartCount() {
        return maxFailuresPerInterval;
    }

    @Override
    public long getDelaySeconds() {
        return delaySeconds;
    }

    private void pruneExpired(long now) {
        long windowMillis = TimeUnit.SECONDS.toMillis(intervalSeconds);
        while (!failureTimestamps.isEmpty() && now - failureTimestamps.peekFirst() > windowMillis) {
            failureTimestamps.pollFirst();
        }
    }
}
