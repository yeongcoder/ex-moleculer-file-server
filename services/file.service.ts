"use strict";

import { Service as MoleculerService, Context, Errors } from "moleculer";
import { Service, Action, Method, Event } from "moleculer-decorators";
import fs, { ReadStream, WriteStream, statSync } from "fs";
import path from "path";
import mime from "mime-types";


@Service({
    name: "file",
    mixins: [],
	settings: {
        storageConfig: {
            disks:{
                local: {
                    driver: "local",
                    root: "public"
                },
                // nfs: {},
                // smb: {},
                // afp: {},
                // ftp: {},
                // webdav: {},
            }
        }
	},
})
class FileService extends MoleculerService {

    /**
     * ==========================================================================
     * Actions
     * ==========================================================================
     */

    /**
     * Upload (single, multi)
     * @param { Context<ReadStream, {filename: string, signature:any}> } ctx 
     * @returns { Promise<Object | Error>} 
     */
    @Action({
        name: "upload",
    })
    upload(ctx: Context<any, { filename: string, signature:any }>): Promise<Object | Error> {
        return new Promise(async (resolve, reject) => {

            this.logger.info("ctx.meta ==>", ctx.meta);
            this.logger.info("ctx.params.$params ==>", ctx.params.$params);

            const uploadDir:string = path.join(`${__dirname}/../${this.settings.storageConfig.disks.local.root}`);
            const fileName:string = ctx.meta.filename || ctx.params.$params.file;
            const filePath:string = path.join(uploadDir, fileName);
            const readFileStream:ReadStream = ctx.params;

            try {

                //upload file to filePath
                await this.uploadFile(filePath, readFileStream);

                //for Mobile CI/CD 
                this.createPlistFile(fileName);

                resolve("OK");

            } catch(err){

                this.logger.error(err);
                reject(err);

            }
        });
    }

    /**
     * Download (single)
     * @param { Context<{file: string}, {$responseHeaders: any}> } ctx 
     * @returns { ReadStream | Errors.MoleculerError }
     */
    @Action({
        name: "download",
        params: {
            file: "string"
        }
    })
    download(ctx: Context<{file: string}, {$responseHeaders: any}>): ReadStream | Errors.MoleculerError {

        this.logger.info("ctx.params: ", ctx.params);

        const uploadDir:string = path.join(`${__dirname}/../${this.settings.storageConfig.disks.local.root}`);
        const filePath:string = path.join(uploadDir, ctx.params.file);

        //요청 파일이 존재하지않으면 에러
        if(!fs.existsSync(filePath)) return new Errors.MoleculerError("Not Found", 404);

        const fileStats:fs.Stats = fs.statSync(filePath);
        const fileSize:number = fileStats.size;

        ctx.meta.$responseHeaders = {
            "Content-Length": fileSize,
            "Content-Type": mime.lookup(ctx.params.file),
        }

        const readFileStream:ReadStream = fs.createReadStream(filePath);

        return readFileStream;
    }

    /**
     * Delete (single) 
     * @param { Context<{file: string} } ctx 
     * @returns { string | Errors.MoleculerError }
     */
    @Action({
        name: "delete",
        params: {
            file: "string"
        }
    })
    delete(ctx: Context<{file: string}>): string | Errors.MoleculerError {

        this.logger.info("ctx.params: ", ctx.params);

        const uploadDir:string = path.join(`${__dirname}/../${this.settings.storageConfig.disks.local.root}`);
        const filePath:string = path.join(uploadDir, ctx.params.file);

        //요청 파일이 존재하지않으면 에러
        if(!fs.existsSync(filePath)) return new Errors.MoleculerError("Not Found", 404);

        fs.unlinkSync(filePath);

        return "OK";
    }

    /**
     * Get File List
     * @param { Context } ctx 
     * @returns { string[] | Error }
     */
    @Action({
        name: "list"
    })
    list(ctx: Context): string[] | Error {

        const uploadDir:string = path.join(`${__dirname}/../${this.settings.storageConfig.disks.local.root}`);

        !fs.existsSync(uploadDir) && fs.mkdirSync(uploadDir);

        const filePath = path.join(uploadDir);
        
        if (!fs.existsSync(filePath)) return new Error();

        const fileList:string[] = fs.readdirSync(filePath)

        return fileList
        
    }

    /**
     * ==========================================================================
     * Events
     * ==========================================================================
     */
    //@Event


    /**
     * ==========================================================================
     * Methods
     * ==========================================================================
     */

    /**
     * Pipe read able file stream to write able file stream
     * @param { string } filePath 
     * @param { ReadStream }readFileStream 
     * @returns Promise<Errors.MoleculerServerError | void>
     */
    @Method
    private uploadFile(filePath: string, readFileStream: ReadStream): Promise<Errors.MoleculerServerError | void>{
        return new Promise((resolve, reject) => {

            const writeFileStream:WriteStream = fs.createWriteStream(filePath);

            readFileStream.on("error", (err: Error) => {

                reject(new Errors.MoleculerServerError("File error received", 500))
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
        })
    }

    /**
     * Create "fileName.plist" File for Mobile CI/CD 
     * @param { string } fileName 
     * @returns 
     */
    @Method
    private createPlistFile(fileName: string){

        if(path.extname(fileName) != ".ipa") return;

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
        `
        const plistFile = fs.createWriteStream(path.join(`${__dirname}/../${this.settings.storageConfig.disks.local.root}`, fileName.replace("ipa", "plist")));
        //plistFile.write(plistContents);
        plistFile.end(plistContents);
    }

   /**
   * ==========================================================================
   * Reserved for moleculer
   * ==========================================================================
   */

   /**
   * Service created lifecycle event handler
   */
   async created(){
        this.logger.info(`${this.name} CREATED!`);
    }


    /**
     *Service started lifecycle event handler
    */
    async started(){
        this.logger.info(`${this.name} STARTED!`);
    }


    /**
     * Service stopped lifecycle event handler
     */
    async stopped(){
        this.logger.info(`${this.name} STOPPED!`);
    }
}

export default FileService;