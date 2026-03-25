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

package org.apache.seatunnel.engine.server.task.group.queue;

import org.apache.seatunnel.api.table.type.Record;
import org.apache.seatunnel.api.transform.Collector;
import org.apache.seatunnel.engine.server.task.group.queue.disruptor.RecordEvent;
import org.apache.seatunnel.engine.server.task.group.queue.disruptor.RecordEventHandler;
import org.apache.seatunnel.engine.server.task.group.queue.disruptor.RecordEventProducer;

import com.lmax.disruptor.ExceptionHandler;
import com.lmax.disruptor.dsl.Disruptor;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
public class IntermediateDisruptor extends AbstractIntermediateQueue<Disruptor<RecordEvent>> {

    public IntermediateDisruptor(Disruptor<RecordEvent> queue) {
        super(queue);
    }

    private volatile boolean isExecuted;

    @Override
    public void received(Record<?> record) {
        getIntermediateQueue().getRingBuffer();
        RecordEventProducer.onData(
                record,
                getIntermediateQueue().getRingBuffer(),
                getIntermediateQueueFlowLifeCycle());
    }

    @Override
    public void collect(Collector<Record<?>> collector) throws Exception {
        // Check if any exception occurred in the Disruptor thread and propagate it
        checkException();
        if (!isExecuted) {
            Disruptor<RecordEvent> disruptor = getIntermediateQueue();
            disruptor.setDefaultExceptionHandler(new DisruptorExceptionHandler());
            disruptor.handleEventsWith(
                    new RecordEventHandler(
                            getRunningTask(), collector, getIntermediateQueueFlowLifeCycle()));
            disruptor.start();
            isExecuted = true;
        } else {
            Thread.sleep(100);
        }
    }

    /** Custom exception handler to capture and propagate exceptions from Disruptor thread. */
    private class DisruptorExceptionHandler implements ExceptionHandler<RecordEvent> {
        @Override
        public void handleEventException(Throwable ex, long sequence, RecordEvent event) {
            log.error(
                    "Exception occurred while processing event in Disruptor, sequence: {}",
                    sequence,
                    ex);
            recordException(ex);
        }

        @Override
        public void handleOnStartException(Throwable ex) {
            log.error("Exception occurred during Disruptor startup", ex);
            recordException(ex);
        }

        @Override
        public void handleOnShutdownException(Throwable ex) {
            log.error("Exception occurred during Disruptor shutdown", ex);
        }
    }

    @Override
    public void close() throws IOException {
        getIntermediateQueue().shutdown();
    }
}
