//  #region Global Imports
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import ApiGateway from "moleculer-web";
import { Errors, Service, ServiceSchema, ServiceBroker, Context } from "moleculer";

export default class ApiService extends Service {
  public constructor(broker: ServiceBroker) {
    super(broker);
    // @ts-ignore
    const apiGatewayServiceSchema: ServiceSchema = {
      name: "api",
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
          maxAge: null,
        },
        // HTTPS server with certificate
        https:
          process.env.USE_SSL === "true"
            ? {
                key: fs.readFileSync(path.join(__dirname, "../" + process.env.SSL_KEY)),
                cert: fs.readFileSync(path.join(__dirname, "../" + process.env.SSL_CERT)),
              }
            : null,
        http2: process.env.USE_SSL === "true" ? true : false,
        routes: [
          {
            path: "/api",
            whitelist: [
              // Access to any actions in all services under "/api" URL
              "**",
            ],
            // Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
            use: [],
            // Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
            mergeParams: true,

            // Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
            authentication: false,

            // Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
            authorization: false,

            // The auto-alias feature allows you to declare your route alias directly in your services.
            // The gateway will dynamically build the full routes from service schema.
            autoAliases: true,

            aliases: {},
            /**
             * Before call hook. You can check the request.
             * @param {Context} ctx
             * @param {Object} route
             * @param {IncomingMessage} req
             * @param {ServerResponse} res
             * @param {Object} data
            onBeforeCall(ctx: Context<any,{userAgent: string}>,
                route: object, req: IncomingMessage, res: ServerResponse) {
                Set request headers to context meta
                ctx.meta.userAgent = req.headers["user-agent"];
            },
            */

            /**
             * After call hook. You can modify the data.
             * @param {Context} ctx
             * @param {Object} route
             * @param {IncomingMessage} req
             * @param {ServerResponse} res
             * @param {Object} data
             *
             onAfterCall(ctx: Context, route: object, req: IncomingMessage, res: ServerResponse, data: object) {
                //Async function which return with Promise
                return doSomething(ctx, res, data);
            },
            */

            // Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
            callingOptions: {},

            bodyParsers: {
              json: {
                strict: false,
                limit: "1MB",
              },
              urlencoded: {
                extended: true,
                limit: "1MB",
              },
            },

            // Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
            mappingPolicy: "all", // Available values: "all", "restrict"

            // Enable/disable logging
            logging: true,
          },
          {
            //  Storage Service Router
            path: "",
            bodyParsers: {
              json: false,
              urlencoded: false,
            },
            whitelist: ["storage.upload", "storage.download", "storage.delete"],
            authentication: true,
            aliases: {
              //  Upload File by Pre-signed URL
              "PUT /:file": {
                type: "stream",
                busboyConfig: {
                  fileSize: parseInt(process.env.FILE_SIZE, 10),
                },
                action: "storage.upload",
              },

              //  Download File by Pre-signed URL
              "GET /:file": "storage.download",

              //  Delete File by Pre-signed URL
              "DELETE /:file": "storage.delete",
              //  Upload Multi File
              "POST /multi/:file": {
                type: "multipart",
                // Action level busboy config
                busboyConfig: {
                  limits: {
                    files: parseInt(process.env.FILE_LIMIT, 10),
                    fileSize: parseInt(process.env.FILE_SIZE, 10),
                  },
                  onPartsLimit(busboy: any, alias: any, svc: any) {
                    this.logger.info("Busboy parts limit!", busboy);
                    console.log("Busboy parts limit!", busboy);
                  },
                  onFilesLimit(busboy: any, alias: any, svc: any) {
                    this.logger.info("Busboy file limit!", busboy);
                    console.log("Busboy parts limit!", busboy);
                  },
                  onFieldsLimit(busboy: any, alias: any, svc: any) {
                    this.logger.info("Busboy fields limit!", busboy);
                    console.log("Busboy parts limit!", busboy);
                  },
                },
                action: "storage.upload",
              },
            },
            mappingPolicy: "restrict",
          },
          {
            //  Demo API Router
            path: "/demo",
            bodyParsers: {
              json: true,
            },
            whitelist: ["storage.list"],
            aliases: {
              "GET /list": "storage.list",
            },
          },
        ],
        assets: {
          folder: "public",
        },
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

        async authenticate(
          ctx: Context<any, { signature: any }>,
          route: any,
          req: any
        ): Promise<any> {
          this.logger.info("req.query ==>", req.query);

          const ucsSignature: string = req.query["x-ucw-signature"];
          if (ucsSignature) {
            let signatureDecoded: string | object;
            try {
              signatureDecoded = jwt.verify(ucsSignature, process.env.UCS_SECRET_KEY);
            } catch (err) {
              this.logger.error(err);
              throw new ApiGateway.Errors.ForbiddenError("INVAILD_SIGNATURE", {
                error: "Invaild Signature",
              });
            }
            this.logger.info("signatureDecoded: ", signatureDecoded);

            ctx.meta.signature = signatureDecoded;

            return;
          } else {
            return null;
          }
        },
      },
    };
    this.parseServiceSchema(apiGatewayServiceSchema);
  }
}
