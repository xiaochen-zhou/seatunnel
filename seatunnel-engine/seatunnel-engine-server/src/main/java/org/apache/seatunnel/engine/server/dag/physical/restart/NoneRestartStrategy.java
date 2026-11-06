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

/** A strategy that never restarts a failed pipeline. */
public class NoneRestartStrategy implements PipelineRestartStrategy {

    public static final String NAME = "none";

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public boolean canRestart() {
        return false;
    }

    @Override
    public void notifyRestart() {
        // Nothing to record: a pipeline is never restored with this strategy.
    }

    @Override
    public int getRestartCount() {
        return 0;
    }

    @Override
    public int getMaxRestartCount() {
        return 0;
    }

    @Override
    public long getDelaySeconds() {
        return 0L;
    }
}
