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

package org.apache.seatunnel.engine.server.dag.physical;

import org.apache.seatunnel.engine.server.execution.TaskDeployState;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PhysicalVertexSlotReallocateTest {

    @Test
    void unknownSlotFailureShouldTriggerReallocate() {
        assertTrue(
                PhysicalVertex.isUnknownSlotFailure(
                        TaskDeployState.failed(
                                new RuntimeException(
                                        "org.apache.seatunnel.engine.server.exception.TaskGroupDeployException: "
                                                + "org.apache.seatunnel.engine.server.service.slot.WrongTargetSlotException: "
                                                + "Unknown slot in slot service, slot profile: SlotProfile{worker=[10.217.65.89]:5801, slotID=1152}"))));
    }

    @Test
    void wrongTargetSlotWithoutUnknownSlotTextShouldAlsoReallocate() {
        assertTrue(
                PhysicalVertex.isUnknownSlotFailure(
                        TaskDeployState.failed(
                                new RuntimeException(
                                        "WrongTargetSlotException: slot not found on worker"))));
    }

    @Test
    void otherDeployFailureShouldNotReallocate() {
        assertFalse(
                PhysicalVertex.isUnknownSlotFailure(
                        TaskDeployState.failed(new RuntimeException("No enough resource"))));
        assertFalse(PhysicalVertex.isUnknownSlotFailure(TaskDeployState.success()));
    }
}
