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

public class FixedDelayRestartStrategyTest {

    @Test
    public void testRestartBudgetIsCumulative() {
        FixedDelayRestartStrategy strategy = new FixedDelayRestartStrategy(2, 5);

        Assertions.assertEquals(FixedDelayRestartStrategy.NAME, strategy.getName());
        Assertions.assertTrue(strategy.canRestart());
        strategy.notifyRestart();
        Assertions.assertTrue(strategy.canRestart());
        strategy.notifyRestart();

        Assertions.assertFalse(strategy.canRestart());
        Assertions.assertEquals(2, strategy.getRestartCount());
        Assertions.assertEquals(2, strategy.getMaxRestartCount());
        Assertions.assertEquals(5, strategy.getDelaySeconds());
    }

    @Test
    public void testZeroAttemptsDisablesRestart() {
        FixedDelayRestartStrategy strategy = new FixedDelayRestartStrategy(0, 0);

        Assertions.assertFalse(strategy.canRestart());
        Assertions.assertEquals(0, strategy.getDelaySeconds());
    }

    @Test
    public void testInvalidArgumentsAreRejected() {
        Assertions.assertThrows(
                IllegalArgumentException.class, () -> new FixedDelayRestartStrategy(-1, 1));
        Assertions.assertThrows(
                IllegalArgumentException.class, () -> new FixedDelayRestartStrategy(1, -1));
    }
}
