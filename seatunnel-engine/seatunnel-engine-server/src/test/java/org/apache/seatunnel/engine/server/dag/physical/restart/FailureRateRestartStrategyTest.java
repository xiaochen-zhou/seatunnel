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

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.function.LongSupplier;

public class FailureRateRestartStrategyTest {

    @Test
    public void testBudgetIsRefreshedAfterTheWindow() {
        MutableClock clock = new MutableClock();
        FailureRateRestartStrategy strategy = new FailureRateRestartStrategy(1, 10, 2, clock);

        Assertions.assertEquals(FailureRateRestartStrategy.NAME, strategy.getName());
        Assertions.assertTrue(strategy.canRestart());
        strategy.notifyRestart();
        Assertions.assertFalse(strategy.canRestart());

        clock.advance(10_001L);
        Assertions.assertTrue(strategy.canRestart());
        strategy.notifyRestart();
        Assertions.assertEquals(2, strategy.getRestartCount());
    }

    @Test
    public void testFailuresInsideTheWindowStillCount() {
        MutableClock clock = new MutableClock();
        FailureRateRestartStrategy strategy = new FailureRateRestartStrategy(2, 10, 1, clock);
        strategy.notifyRestart();

        clock.advance(5_000L);
        Assertions.assertTrue(strategy.canRestart());
        strategy.notifyRestart();

        clock.advance(4_000L);
        Assertions.assertFalse(strategy.canRestart());
    }

    @Test
    public void testMaxFailuresIsReportedAndDelayExposed() {
        FailureRateRestartStrategy strategy =
                new FailureRateRestartStrategy(4, 60, 7, new MutableClock());

        Assertions.assertEquals(4, strategy.getMaxRestartCount());
        Assertions.assertEquals(7, strategy.getDelaySeconds());
        Assertions.assertEquals(0, strategy.getRestartCount());
    }

    @Test
    public void testInvalidArgumentsAreRejected() {
        MutableClock clock = new MutableClock();
        Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> new FailureRateRestartStrategy(-1, 60, 1, clock));
        Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> new FailureRateRestartStrategy(1, 0, 1, clock));
        Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> new FailureRateRestartStrategy(1, 60, -1, clock));
    }

    private static final class MutableClock implements LongSupplier {

        private long now;

        @Override
        public long getAsLong() {
            return now;
        }

        private void advance(long millis) {
            now += millis;
        }
    }
}
