// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {intlShape} from 'react-intl';
import {
    Alert,
    Platform,
    StyleSheet,
} from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import DeviceInfo from 'react-native-device-info';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ImagePicker from 'react-native-image-picker';
import Permissions from 'react-native-permissions';

import {lookupMimeType} from 'mattermost-redux/utils/file_utils';

import TouchableWithFeedback from 'app/components/touchable_with_feedback';
import {PermissionTypes} from 'app/constants';

export default class AttachmentButton extends PureComponent {
    static propTypes = {
        validMimeTypes: PropTypes.array,
        fileCount: PropTypes.number,
        maxFileCount: PropTypes.number.isRequired,
        maxFileSize: PropTypes.number.isRequired,
        onShowFileMaxWarning: PropTypes.func,
        onShowFileSizeWarning: PropTypes.func,
        onShowUnsupportedMimeTypeWarning: PropTypes.func,
        theme: PropTypes.object.isRequired,
        uploadFiles: PropTypes.func.isRequired,
    };

    static defaultProps = {
        validMimeTypes: [],
        canTakePhoto: true,
        canTakeVideo: true,
        maxFileCount: 5,
    };

    static contextTypes = {
        intl: intlShape.isRequired,
    };

    getPermissionDeniedMessage = () => {
        const {formatMessage} = this.context.intl;
        const applicationName = DeviceInfo.getApplicationName();
        return {
            title: formatMessage({
                id: 'mobile.camera_photo_permission_denied_title',
                defaultMessage: '{applicationName} would like to access your camera',
            }, {applicationName}),
            text: formatMessage({
                id: 'mobile.camera_photo_permission_denied_description',
                defaultMessage: 'Take photos and upload them to your Mattermost instance or save them to your device. Open Settings to grant Mattermost Read and Write access to your camera.',
            }),
        };
    }

    attachFileFromCamera = async () => {
        const {formatMessage} = this.context.intl;
        const {
            fileCount,
            maxFileCount,
            onShowFileMaxWarning,
        } = this.props;

        const {title, text} = this.getPermissionDeniedMessage();

        if (fileCount === maxFileCount) {
            onShowFileMaxWarning();
            return;
        }

        const options = {
            quality: 0.8,
            videoQuality: 'high',
            noData: true,
            mediaType: 'mixed',
            storageOptions: {
                cameraRoll: true,
                waitUntilSaved: true,
            },
            permissionDenied: {
                title,
                text,
                reTryTitle: formatMessage({
                    id: 'mobile.permission_denied_retry',
                    defaultMessage: 'Settings',
                }),
                okTitle: formatMessage({id: 'mobile.permission_denied_dismiss', defaultMessage: 'Don\'t Allow'}),
            },
        };

        const hasCameraPermission = await this.hasCameraPermission();

        if (hasCameraPermission) {
            ImagePicker.launchCamera(options, (response) => {
                if (response.error || response.didCancel) {
                    return;
                }

                this.uploadFiles([response]);
            });
        }
    };

    hasCameraPermission = async () => {
        if (Platform.OS === 'ios') {
            const {formatMessage} = this.context.intl;
            let permissionRequest;
            const targetSource = 'camera';
            const hasPermissionToStorage = await Permissions.check(targetSource);

            switch (hasPermissionToStorage) {
            case PermissionTypes.UNDETERMINED:
                permissionRequest = await Permissions.request(targetSource);
                if (permissionRequest !== PermissionTypes.AUTHORIZED) {
                    return false;
                }
                break;
            case PermissionTypes.DENIED: {
                const canOpenSettings = await Permissions.canOpenSettings();
                let grantOption = null;
                if (canOpenSettings) {
                    grantOption = {
                        text: formatMessage({
                            id: 'mobile.permission_denied_retry',
                            defaultMessage: 'Settings',
                        }),
                        onPress: () => Permissions.openSettings(),
                    };
                }

                const {title, text} = this.getPermissionDeniedMessage();

                Alert.alert(
                    title,
                    text,
                    [
                        grantOption,
                        {
                            text: formatMessage({
                                id: 'mobile.permission_denied_dismiss',
                                defaultMessage: 'Don\'t Allow',
                            }),
                        },
                    ],
                );
                return false;
            }
            }
        }

        return true;
    };

    uploadFiles = async (files) => {
        const file = files[0];
        if (!file.fileSize | !file.fileName) {
            const path = (file.path || file.uri).replace('file://', '');
            const fileInfo = await RNFetchBlob.fs.stat(path);
            file.fileSize = fileInfo.size;
            file.fileName = fileInfo.filename;
        }

        if (!file.type) {
            file.type = lookupMimeType(file.fileName);
        }

        const {validMimeTypes} = this.props;
        if (validMimeTypes.length && !validMimeTypes.includes(file.type)) {
            this.props.onShowUnsupportedMimeTypeWarning();
        } else if (file.fileSize > this.props.maxFileSize) {
            this.props.onShowFileSizeWarning(file.fileName);
        } else {
            this.props.uploadFiles(files);
        }
    };

    render() {
        const {theme} = this.props;

        return (
            <TouchableWithFeedback
                onPress={this.attachFileFromCamera}
                style={style.buttonContainer}
                type={'opacity'}
            >
                <MaterialCommunityIcons
                    color={theme.centerChannelColor}
                    name='camera-outline'
                    size={20}
                />
            </TouchableWithFeedback>
        );
    }
}

const style = StyleSheet.create({
    buttonContainer: {
        paddingLeft: 10,
        paddingRight: 10,
    },
});