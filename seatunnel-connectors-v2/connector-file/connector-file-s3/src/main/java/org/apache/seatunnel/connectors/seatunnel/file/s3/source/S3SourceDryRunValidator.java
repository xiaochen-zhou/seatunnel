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

package org.apache.seatunnel.connectors.seatunnel.file.s3.source;

import org.apache.seatunnel.api.configuration.ReadonlyConfig;
import org.apache.seatunnel.api.options.ConnectorCommonOptions;
import org.apache.seatunnel.api.options.table.ColumnOptions;
import org.apache.seatunnel.api.options.table.FieldOptions;
import org.apache.seatunnel.connectors.seatunnel.file.config.FileBaseSourceOptions;
import org.apache.seatunnel.connectors.seatunnel.file.config.FileDiscoveryMode;
import org.apache.seatunnel.connectors.seatunnel.file.config.FileFormat;
import org.apache.seatunnel.connectors.seatunnel.file.config.HadoopConf;
import org.apache.seatunnel.connectors.seatunnel.file.s3.config.S3FileSourceOptions;
import org.apache.seatunnel.connectors.seatunnel.file.s3.config.S3HadoopConf;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.fs.s3a.AWSCredentialProviderList;
import org.apache.hadoop.fs.s3a.Constants;
import org.apache.hadoop.fs.s3a.DefaultS3ClientFactory;
import org.apache.hadoop.fs.s3a.S3AUtils;
import org.apache.hadoop.fs.s3a.S3ClientFactory;
import org.apache.hadoop.fs.s3a.auth.CredentialProviderListFactory;

import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.retry.RetryPolicy;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;

final class S3SourceDryRunValidator {
    private static final int NETWORK_TIMEOUT_MILLIS = 5000;

    private S3SourceDryRunValidator() {}

    /** Rejects schemas that require opening files or altering the configured field layout. */
    static void validateSchemaOptions(ReadonlyConfig options) {
        if (options.getOptional(ConnectorCommonOptions.TABLE_CONFIGS).isPresent()
                || !options.getOptional(ConnectorCommonOptions.SCHEMA).isPresent()) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires a single table with an explicit inline schema.");
        }
        Map<String, Object> schema = options.get(ConnectorCommonOptions.SCHEMA);
        if (schema.containsKey(ColumnOptions.METADATA_TABLE_ID.key())
                || (!options.getOptional(FieldOptions.FIELDS).isPresent()
                        && !schema.containsKey(ColumnOptions.COLUMNS.key()))) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires schema.fields or schema.columns, not metadata schema lookup.");
        }
        if (!Arrays.asList(FileFormat.TEXT, FileFormat.CSV, FileFormat.JSON, FileFormat.XML)
                .contains(options.get(FileBaseSourceOptions.FILE_FORMAT_TYPE))) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run supports text, csv, json and xml without reading file contents.");
        }
        if (options.get(FileBaseSourceOptions.PARSE_PARTITION_FROM_PATH)
                || options.getOptional(FileBaseSourceOptions.READ_COLUMNS).isPresent()) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires parse_partition_from_path=false and no read_columns to preserve the runtime schema.");
        }
    }

    /** Checks metadata with a private client, closing credentials even when client setup fails. */
    static void validate(ReadonlyConfig options) throws IOException {
        // The connection hook can be called directly, without the preceding schema hook.
        validateSchemaOptions(options);
        URI bucket = bucketUri(options);
        Path path = sourcePath(options, bucket);
        Configuration configuration = validationConfiguration(options, bucket);
        DryRunClientFactory factory = new DryRunClientFactory(configuration);
        try (AWSCredentialProviderList credentials =
                        CredentialProviderListFactory.createAWSCredentialProviderList(
                                bucket, configuration);
                S3Client client = factory.createClient(bucket, configuration, credentials)) {
            validatePath(
                    client,
                    bucket.getHost(),
                    path,
                    options.get(FileBaseSourceOptions.DISCOVERY_MODE),
                    configuration.getInt(Constants.LIST_VERSION, Constants.DEFAULT_LIST_VERSION));
        }
    }

    /** Accepts only a bare S3A bucket URI, without echoing potentially sensitive input. */
    static URI bucketUri(ReadonlyConfig options) {
        URI bucket;
        try {
            bucket = URI.create(options.get(S3FileSourceOptions.S3_BUCKET));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires an s3a://bucket URI.");
        }
        if (!"s3a".equals(bucket.getScheme())
                || bucket.getHost() == null
                || bucket.getUserInfo() != null
                || bucket.getPort() != -1
                || bucket.getQuery() != null
                || bucket.getFragment() != null
                || (!bucket.getPath().isEmpty() && !"/".equals(bucket.getPath()))) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires an s3a://bucket URI.");
        }
        return bucket;
    }

    /** Keeps metadata requests inside the configured bucket, using the source's absolute path. */
    static Path sourcePath(ReadonlyConfig options, URI bucket) {
        Path path;
        try {
            path = new Path(options.get(FileBaseSourceOptions.FILE_PATH));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires an absolute path in the configured bucket.");
        }
        URI uri = path.toUri();
        if (!path.isAbsolute()
                || (uri.getScheme() != null && !"s3a".equals(uri.getScheme()))
                || (uri.getAuthority() != null
                        && !bucket.getAuthority().equals(uri.getAuthority()))) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires an absolute path in the configured bucket.");
        }
        return path;
    }

    /**
     * Preserves S3A connection settings but rejects filesystem side effects, custom client
     * lifecycle behavior, and encryption/credential-store paths not supported by this metadata-only
     * client. Disables retries so a preflight check does not inherit the production retry budget.
     */
    static Configuration validationConfiguration(ReadonlyConfig options, URI bucket) {
        HadoopConf hadoopConf = S3HadoopConf.buildWithReadOnlyConfig(options);
        Configuration configuration = hadoopConf.toConfiguration();
        hadoopConf.setExtraOptionsForConfiguration(configuration);
        configuration = S3AUtils.propagateBucketOptions(configuration, bucket.getHost());
        if (configuration.getBoolean(Constants.PURGE_EXISTING_MULTIPART, false)) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run does not support multipart purge.");
        }
        if (!configuration.getTrimmed(Constants.S3A_SECURITY_CREDENTIAL_PROVIDER_PATH, "").isEmpty()
                || "SSE-C"
                        .equalsIgnoreCase(
                                configuration.getTrimmed(
                                        Constants.SERVER_SIDE_ENCRYPTION_ALGORITHM, ""))) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run does not support SSE-C or fs.s3a.security.credential.provider.path.");
        }
        clampTimeout(configuration, bucket, Constants.ESTABLISH_TIMEOUT);
        clampTimeout(configuration, bucket, Constants.SOCKET_TIMEOUT);
        S3AUtils.clearBucketOption(configuration, bucket.getHost(), Constants.MAX_ERROR_RETRIES);
        configuration.setInt(Constants.MAX_ERROR_RETRIES, 0);
        return configuration;
    }

    /** Caps each network wait at five seconds for preflight, retaining stricter user limits. */
    private static void clampTimeout(Configuration configuration, URI bucket, String key) {
        long configured =
                configuration.getTimeDuration(
                        key,
                        NETWORK_TIMEOUT_MILLIS + "ms",
                        java.util.concurrent.TimeUnit.MILLISECONDS);
        if (configured < 0) {
            throw new IllegalArgumentException(
                    "S3File connect dry-run requires non-negative " + key);
        }
        S3AUtils.clearBucketOption(configuration, bucket.getHost(), key);
        long clamped =
                configured == 0
                        ? NETWORK_TIMEOUT_MILLIS
                        : Math.min(configured, NETWORK_TIMEOUT_MILLIS);
        configuration.set(key, clamped + "ms");
    }

    /**
     * Tries HEAD first so exact objects need no listing permission. Only a missing object falls
     * back to one bounded prefix listing; permission and other failures must not be treated as
     * absence.
     */
    static void validatePath(
            S3Client client,
            String bucket,
            Path path,
            FileDiscoveryMode discoveryMode,
            int listVersion)
            throws IOException {
        String key = path.toUri().getPath().substring(1);
        if (!key.isEmpty()) {
            try {
                client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
                return;
            } catch (NoSuchKeyException e) {
                // Missing object: fall back to one bounded prefix listing below.
            } catch (S3Exception e) {
                if (e.statusCode() != 404) {
                    throw e;
                }
            }
        }
        String prefix = key.isEmpty() || key.endsWith("/") ? key : key + "/";
        // The v2 SDK only exposes ListObjectsV2; the S3A list version setting is kept for
        // configuration parity but cannot select the legacy v1 listing API here.
        ListObjectsV2Response result =
                client.listObjectsV2(
                        ListObjectsV2Request.builder()
                                .bucket(bucket)
                                .prefix(prefix)
                                .delimiter("/")
                                .maxKeys(1)
                                .build());
        boolean empty = result.contents().isEmpty() && result.commonPrefixes().isEmpty();
        // Only a successful empty listing proves an accessible prefix awaiting its first file.
        if (empty && !key.isEmpty() && discoveryMode != FileDiscoveryMode.CONTINUOUS) {
            throw new FileNotFoundException(
                    "S3File connect dry-run could not find the configured batch source path.");
        }
    }

    /** Builds a short-lived client from the source configuration and owns its lifecycle. */
    private static final class DryRunClientFactory extends DefaultS3ClientFactory {
        private final int timeoutMillis;

        private DryRunClientFactory(Configuration configuration) {
            setConf(configuration);
            this.timeoutMillis =
                    (int)
                            Math.max(
                                    1L,
                                    configuration.getTimeDuration(
                                            Constants.SOCKET_TIMEOUT,
                                            NETWORK_TIMEOUT_MILLIS + "ms",
                                            java.util.concurrent.TimeUnit.MILLISECONDS));
        }

        private S3Client createClient(
                URI bucket, Configuration configuration, AWSCredentialProviderList credentials)
                throws IOException {
            S3ClientFactory.S3ClientCreationParameters parameters =
                    new S3ClientFactory.S3ClientCreationParameters()
                            .withCredentialSet(credentials)
                            .withPathStyleAccess(
                                    configuration.getBoolean(Constants.PATH_STYLE_ACCESS, false));
            String endpoint = configuration.getTrimmed(Constants.ENDPOINT, "");
            if (!endpoint.isEmpty()) {
                parameters.withEndpoint(endpoint);
            }
            String region = configuration.getTrimmed(Constants.AWS_REGION, "");
            if (!region.isEmpty()) {
                parameters.withRegion(region);
            }
            return createS3Client(bucket, parameters);
        }

        @Override
        protected ClientOverrideConfiguration.Builder createClientOverrideConfiguration(
                S3ClientFactory.S3ClientCreationParameters parameters, Configuration configuration)
                throws IOException {
            return super.createClientOverrideConfiguration(parameters, configuration)
                    .apiCallTimeout(Duration.ofMillis(timeoutMillis))
                    .apiCallAttemptTimeout(Duration.ofMillis(timeoutMillis))
                    .retryPolicy(RetryPolicy.none());
        }
    }
}
