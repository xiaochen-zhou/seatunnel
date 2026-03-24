package org.apache.seatunnel.engine.imap.storage.file.config;

import org.apache.seatunnel.engine.imap.storage.api.exception.IMapStorageException;

import org.apache.hadoop.conf.Configuration;

import java.util.Map;

/**
 * @author ：xiaochen.zhou@ly.com
 * @date ：2026-3-16 10:55
 * @description : TODO
 * @modified By：
 * @version: 1.0.0
 */
public class JfsConfiguration extends AbstractConfiguration {

    private static final String JFS_KEY = "fs.jfs.impl";
    private static final String JFS = "io.juicefs.JuiceFileSystem";

    private static final String JFS_IMPL_KEY = "fs.AbstractFileSystem.jfs.impl";
    private static final String JFS_IMPL = "io.juicefs.JuiceFS";

    public static final String JFS_BUCKET_KEY = "juicefs.bucket";
    public static final String JFS_META_KEY = "juicefs.meta";

    //		private static final String OSS_KEY = "fs.jfs.";

    @Override
    public Configuration buildConfiguration(Map<String, String> config)
            throws IMapStorageException {
        checkConfiguration(config, JFS_BUCKET_KEY);
        Configuration hadoopConf = new Configuration();
        hadoopConf.set(JFS_KEY, JFS);
        hadoopConf.set(JFS_IMPL_KEY, JFS_IMPL);
        hadoopConf.set(JFS_BUCKET_KEY, config.get(JFS_BUCKET_KEY));
        hadoopConf.set(JFS_META_KEY, config.get(JFS_META_KEY));

        //				setExtraConfiguration(hadoopConf, config, OSS_KEY);
        return hadoopConf;
    }
}
