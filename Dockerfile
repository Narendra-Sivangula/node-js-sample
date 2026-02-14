FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY . .

#--------------- CI TRACEABILITY FOR OBSERVABILITY ---------------------
ARG BUILD_ID
ARG IMAGE_TAG
ARG JOB_NAME

LABEL ci.build_id="$BUILD_ID"\
      ci.image_id="$IMAGE_TAG"\
      ci.job_name="$JOB_NAME"
# -----------------------------------------------------

EXPOSE 3000

CMD ["node", "index.js"]
