/* eslint-disable capitalized-comments */
"use strict";

import fs, { ReadStream, WriteStream } from "fs";
import path from "path";
import mime from "mime-types";
import { Service, ServiceBroker, ServiceSchema, Context, Errors } from "moleculer";

export default class StorageService extends Service {
  // @ts-ignore
  public constructor(broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
    super(broker);
    this.parseServiceSchema(
      Service.mergeSchemas(
        {
          name: "storage",
          mixins: [],
          settings: {
            storageConfig: {
              disks: {
                local: {
                  driver: "local",
                  root: "public",
                },
                // nfs: {},
                // smb: {},
                // afp: {},
                // ftp: {},
                // webdav: {},
              },
            },
          },
          hooks: {},
          actions: {
            upload: {
              /**
               * Upload (single, multi)
               * @param { Context<ReadStream, {filename: string, signature:any}> } ctx
               * @returns { Promise<Object | Error>}
               */
              async handler(
                ctx: Context<any, { filename: string; signature: any }>
              ): Promise<string> {
                this.logger.info("ctx.meta ==>", ctx.meta);
                this.logger.info("ctx.params.$params ==>", ctx.params.$params);

                const uploadDir: string = this.getUploadDir();

                this.upsertDir(uploadDir);

                const fileName: string = ctx.meta.filename || ctx.params.$params.file;
                const filePath: string = path.join(uploadDir, fileName);
                const readFileStream: ReadStream = ctx.params;

                //  Upload file to filePath
                await this.uploadFile(filePath, readFileStream);

                //  For Mobile CI/CD
                this.createPlistFile(fileName);

                return "OK";
              },
            },
            download: {
              /**
               * Download (single)
               * @param { Context<{file: string}, {$responseHeaders: any}> } ctx
               * @returns { ReadStream | Errors.MoleculerError }
               */
              handler(
                ctx: Context<{ file: string }, { $responseHeaders: any }>
              ): ReadStream | Errors.MoleculerError {
                const uploadDir: string = this.getUploadDir();
                const filePath: string = path.join(uploadDir, ctx.params.file);

                //  요청 파일이 존재하지않으면 에러
                if (!fs.existsSync(filePath)) {
                  return new Errors.MoleculerError("Not Found", 404);
                }

                const fileStats: fs.Stats = fs.statSync(filePath);
                const fileSize: number = fileStats.size;

                ctx.meta.$responseHeaders = {
                  "Content-Length": fileSize,
                  "Content-Type": mime.lookup(ctx.params.file),
                };

                const readFileStream: ReadStream = fs.createReadStream(filePath);

                return readFileStream;
              },
            },
            delete: {
              /**
               * Delete (single)
               * @param { Context<{file: string} } ctx
               * @returns { string | Errors.MoleculerError }
               */
              handler(ctx: Context<{ file: string }>): string | Errors.MoleculerError {
                this.logger.info("ctx.params: ", ctx.params);

                const uploadDir: string = this.getUploadDir();
                const filePath: string = path.join(uploadDir, ctx.params.file);

                //  요청 파일이 존재하지않으면 에러
                if (!fs.existsSync(filePath)) {
                  return new Errors.MoleculerError("Not Found", 404);
                }

                fs.unlinkSync(filePath);

                return "OK";
              },
            },
            list: {
              /**
               * Get File List
               * @param { Context } ctx
               * @returns { string[] | Error }
               */
              handler(ctx: Context): fs.Dirent[] | Error {
                const uploadDir: string = this.getUploadDir();

                this.upsertDir(uploadDir);

                const filePath = path.join(uploadDir);

                const fileList: fs.Dirent[] = fs
                  .readdirSync(filePath, {
                    withFileTypes: true,
                  })
                  .filter((el: fs.Dirent) => !el.isDirectory());

                this.logger.info("fileList:", fileList);

                return fileList;
              },
            },
          },
          methods: {
            uploadFile(
              filePath: string,
              readFileStream: ReadStream
            ): Promise<Errors.MoleculerServerError | void> {
              return new Promise((resolve, reject) => {
                const writeFileStream: WriteStream = fs.createWriteStream(filePath);

                readFileStream.on("error", (err: Error) => {
                  reject(new Errors.MoleculerServerError("File error received", 500));
                  // Destroy the local file
                  writeFileStream.destroy(err);
                });

                writeFileStream.on("error", (err: Error) => {
                  reject(new Errors.MoleculerServerError("File error writr", 500));
                  // Remove the errored file.zs
                  fs.unlinkSync(filePath);
                });

                writeFileStream.on("close", () => {
                  // File written successfully
                  this.logger.info(`Uploaded file stored in '${filePath}'`);
                  resolve();
                });

                readFileStream.pipe(writeFileStream);
              });
            },
            createPlistFile(fileName: string): void {
              if (path.extname(fileName) !== ".ipa") {
                return;
              }

              const plistContents = `
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
                <plist version="1.0">
                <dict>
                    <key>items</key>
                    <array>
                        <dict>
                            <key>assets</key>
                            <array>
                                <dict>
                                    <key>kind</key>
                                    <string>software-package</string>
                                    <key>url</key>
                                    <string>https://ucworks.tk:3003/file/download/${fileName}</string>
                                </dict>
                                <dict>
                                    <key>kind</key>
                                    <string>display-image</string>
                                    <key>url</key>
                                    <string>https://ucworks.tk/image.57x57.png</string>
                                </dict>
                                <dict>
                                    <key>kind</key>
                                    <string>full-size-image</string>
                                    <key>url</key>
                                    <string>https://ucworks.tk/image.512x512.png</string>
                                </dict>
                            </array>
                            <key>metadata</key>
                            <dict>
                                <key>bundle-identifier</key>
                                <string>com.ucware.ucworks.ng</string>
                                <key>bundle-version</key>
                                <string>1.0</string>
                                <key>kind</key>
                                <string>software</string>
                                <key>platform-identifier</key>
                                <string>com.apple.platform.iphoneos</string>
                                <key>title</key>
                                <string>UCWorksNG</string>
                            </dict>
                        </dict>
                    </array>
                </dict>
                </plist>
              `;
              const plistFile = fs.createWriteStream(
                path.join(this.getUploadDir(), fileName.replace("ipa", "plist"))
              );
              plistFile.end(plistContents);
            },
            upsertDir: (dirPath: string): void => {
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
              }
              return;
            },
            getUploadDir(): string {
              return path.join(`${__dirname}/../${this.settings.storageConfig.disks.local.root}`);
            },
          },
        },
        schema
      )
    );
  }
}
