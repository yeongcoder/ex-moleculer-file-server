# ucworks-storage

# 실행 명령어

- 개발환경으로 실행

    ```bash
    yarn dev
    ```

- 배포환경으로 실행

    ```bash
    yarn start
    ```

- 단위테스트 실행

    ```bash
    yarn test
    ```

- 빌드

    ```bash
    yarn build
    ```

- 린트

    ```bash
    yarn lint
    ```

- 실시간 단위 테스트

    ```bash
    yarn ci
    ```

# 환경변수 포맷

```
NODE_ENV=local
PORT=9003
USE_SSL=false
SSL_KEY=ssl/ncp-privkey.pem
SSL_CERT=ssl/ncp-cert.pem

FILE_SIZE=12500000
UCS_SECRET_KEY=<secret key>
```

```
NODE_ENV=production
PORT=9003
USE_SSL=true
SSL_KEY=../../../etc/letsencrypt/live/ucworks.tk/privkey.pem
SSL_CERT=../../../etc/letsencrypt/live/ucworks.tk/cert.pem

FILE_SIZE=12500000
UCS_SECRET_KEY=<secret key>
```