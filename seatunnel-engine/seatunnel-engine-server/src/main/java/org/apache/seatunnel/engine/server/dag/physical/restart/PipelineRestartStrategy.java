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

/**
 * Decides whether a failed pipeline may be restored and how long to wait before the next attempt.
 *
 * <p>The Zeta engine restores pipelines one by one, so every pipeline owns its own strategy
 * instance. A strategy instance lives as long as the {@link
 * org.apache.seatunnel.engine.server.dag.physical.SubPlan} that owns it.
 */
public interface PipelineRestartStrategy {

    /** Returns the strategy identifier, as configured by {@code job.retry.strategy}. */
    String getName();

    /** Returns {@code true} when the pipeline still has restart budget. */
    boolean canRestart();

    /** Records one restart attempt. Must be called right before the pipeline is restored. */
    void notifyRestart();

    /** Returns the number of restart attempts made so far. */
    int getRestartCount();

    /**
     * Returns the restart budget reported in diagnostics; {@code 0} means no restart is allowed.
     */
    int getMaxRestartCount();

    /** Returns the delay in seconds before the next restart attempt. */
    long getDelaySeconds();
}
