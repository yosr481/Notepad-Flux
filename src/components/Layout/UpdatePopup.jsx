import React from 'react';
import { Download, ArrowCircleDown, CheckCircle, XCircle, WarningCircle, Spinner } from 'phosphor-react';
import styles from './UpdatePopup.module.css';
import { useUpdate } from '../../context/UpdateContext';

export default function UpdatePopup() {
    const { status, progress, updateInfo, error, isManualCheck, downloadUpdate, installUpdate, dismissUpdate } = useUpdate();

    const isHidden = status === 'idle' || status === 'not-available' || (status === 'checking' && !isManualCheck);

    if (isHidden) return null;

    return (
        <div className={styles.popup}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.iconWrapper}>
                    {status === 'checking' && <Spinner size={24} weight="duotone" className={styles.spinner} />}
                    {status === 'available' && <Download size={24} weight="duotone" />}
                    {status === 'downloading' && <ArrowCircleDown size={24} weight="duotone" />}
                    {status === 'downloaded' && <CheckCircle size={24} weight="duotone" />}
                    {status === 'error' && <WarningCircle size={24} weight="duotone" className={styles.errorIcon} />}
                </div>
                <div className={styles.titleRow}>
                    <span className={styles.title}>
                        {status === 'checking' && 'Checking for Updates'}
                        {status === 'available' && 'Update Available'}
                        {status === 'downloading' && 'Downloading Update'}
                        {status === 'downloaded' && 'Update Ready to Install'}
                        {status === 'error' && 'Update Check Failed'}
                    </span>
                    {status !== 'downloading' && status !== 'checking' && (
                        <button className={styles.closeButton} onClick={dismissUpdate} aria-label="Dismiss update">
                            <XCircle size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {status === 'checking' && (
                    <>
                        <p className={styles.description}>
                            Please wait while we check for available updates...
                        </p>
                    </>
                )}

                {status === 'available' && updateInfo && (
                    <>
                        <p className={styles.versionInfo}>
                            Version <span className={styles.version}>{updateInfo.version}</span> is available.
                        </p>
                        <p className={styles.description}>
                            Stay up to date with the latest improvements, features, and bug fixes.
                        </p>
                        <div className={styles.actions}>
                            <button className={styles.buttonPrimary} onClick={downloadUpdate}>
                                <Download size={16} weight="bold" />
                                Download
                            </button>
                            <button className={styles.buttonSecondary} onClick={dismissUpdate}>
                                Later
                            </button>
                        </div>
                    </>
                )}

                {status === 'downloading' && (
                    <>
                        <p className={styles.progressText}>
                            Downloading update... {progress}%
                        </p>
                        <div className={styles.progressBarContainer}>
                            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                        </div>
                        <p className={styles.description}>
                            The update is being downloaded in the background.
                        </p>
                    </>
                )}

                {status === 'downloaded' && (
                    <>
                        <p className={styles.description}>
                            The update has been downloaded successfully. Restart the application to apply the changes.
                        </p>
                        <div className={styles.actions}>
                            <button className={styles.buttonPrimary} onClick={installUpdate}>
                                <ArrowCircleDown size={16} weight="bold" />
                                Restart to Update
                            </button>
                            <button className={styles.buttonSecondary} onClick={dismissUpdate}>
                                Later
                            </button>
                        </div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <p className={styles.errorText}>
                            {error || 'Unable to check for updates. Please try again later.'}
                        </p>
                        <div className={styles.actions}>
                            <button className={styles.buttonSecondary} onClick={dismissUpdate}>
                                Dismiss
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
