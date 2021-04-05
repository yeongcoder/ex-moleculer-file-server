//#region Global Imports
import {IncomingMessage} from "http";
import ApiGateway from 'moleculer-web';
import {  Errors, Service, ServiceSchema, ServiceBroker, Context } from 'moleculer';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

export default class ApiService extends Service {

	public constructor(broker: ServiceBroker) {
		super(broker);
		// @ts-ignore
        var apiGatewayServiceSchema: ServiceSchema = {
            name: 'api',
            mixins: [ApiGateway],

            settings: {
                // Exposed port
                port: process.env.PORT || 9003,
            
                // Exposed IP
                ip: "0.0.0.0",
                path: "",
            
                cors: {
                    // 디폴트 설정
                    // Configures the Access-Control-Allow-Origin CORS header.
                    origin: "*",
                    // Configures the Access-Control-Allow-Methods CORS header.
                    methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE", "HEAD"],
                    // Configures the Access-Control-Allow-Headers CORS header.
                    allowedHeaders: "*",
                    // Configures the Access-Control-Expose-Headers CORS header.
                    exposedHeaders: "*",
                    // Configures the Access-Control-Allow-Credentials CORS header.
                    credentials: true,
                    // Configures the Access-Control-Max-Age CORS header.
                    maxAge: null
                },
            
                // HTTPS server with certificate
                https: {
                    key: fs.readFileSync(path.join(__dirname, "../"+process.env.SSL_KEY)),
                    cert: fs.readFileSync(path.join(__dirname, "../"+process.env.SSL_CERT))
                },
            
                http2: true,
            
                routes: [
                    {
                        path: "",
                        bodyParsers: {
                            json: false,
                            urlencoded: false
                        },
                        whitelist: [
                            "file.upload",
                            "file.download",
                            "file.delete"
                        ],
                        authentication: true,
                        aliases: {
                            //Upload File by Pre-signed URL
                            "PUT /:file": {
                                type: "stream",
                                busboyConfig: {
                                    fileSize: parseInt(process.env.FILE_SIZE)
                                },
                                action: "file.upload"
                            },

                            //Download File by Pre-signed URL
                            "GET /:file": "file.download",

                            //Delete File by Pre-signed URL
                            "DELETE /:file": "file.delete",
            
                            // // Upload Multi File
                            // "POST /:file": {
                            //     type: "multipart",
                            //     // Action level busboy config
                            //     busboyConfig: {
                            //         limits: {
                            //             files: parseInt(process.env.FILE_LIMIT),
                            //             fileSize: parseInt(process.env.FILE_SIZE)
                            //         },
                            //         onPartsLimit(busboy: any, /*alias, svc*/) {
                            //             //this.logger.info("Busboy parts limit!", busboy);
                            //             console.log("Busboy parts limit!", busboy);
                            //         },
                            //         onFilesLimit(busboy: any, /*alias, svc*/) {
                            //             //this.logger.info("Busboy file limit!", busboy);
                            //             console.log("Busboy parts limit!", busboy);
                            //         },
                            //         onFieldsLimit(busboy: any, /*alias, svc*/) {
                            //             //this.logger.info("Busboy fields limit!", busboy);
                            //             console.log("Busboy parts limit!", busboy);
                            //         }
                            //     },
                            //     action: "file.upload"
                            // },
                        },
                        mappingPolicy: "restrict"
                    },
                    {
                        path: "/list",
                        bodyParsers: {
                            json: true,
                        },
                        whitelist: [
                            "file.list"
                        ],
                        aliases: {
                            "GET /": "file.list",
                        }
                    }
                ],
            
                assets: {
                    folder: "public",    //path.join(__dirname, "../public/file/assets") //"
                }
            },

            methods: {
				/**
				 * Authenticate the request. It check the `Authorization` token value in the request header.
				 * Check the token value & resolve the user by the token.
				 * The resolved user will be available in `ctx.meta.user`
				 *
				 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
				 *
				 * @param {Context<any, {signature: any}>} ctx
				 * @param {any} route
				 * @param {any} req
				 * @returns {Promise}
                */

				 async authenticate(ctx: Context<any, {signature: any}>, route: any, req: any): Promise < any > {
                    this.logger.info("req.query ==>",req.query);

                    const ucs_signature:string = req.query['x-ucw-signature']
            
                    if(ucs_signature){

                        let signatureDecoded:string | object;
                        try {
                            signatureDecoded = jwt.verify(ucs_signature, process.env.UCS_SECRET_KEY)
                        } catch(err){
                            this.logger.error(err);
                            throw new ApiGateway.Errors.ForbiddenError("INVAILD_SIGNATURE",{error: "Invaild Signature"});
                        }
                        this.logger.info("signatureDecoded: ", signatureDecoded);

                        ctx.meta.signature = signatureDecoded;

                        return;

                    } else {

                        return null;

                    }
				},
            }

        }
        if(process.env.USE_SSL == "false"){
            delete apiGatewayServiceSchema.settings.https;
            apiGatewayServiceSchema.settings.http2 = false;
        }
		this.parseServiceSchema(apiGatewayServiceSchema);
	}
}