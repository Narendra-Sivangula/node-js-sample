pipeline {
  agent any

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Capture Build Metadata') {
      steps {
        script {

          env.BUILD_ID_TRACE = "${env.JOB_NAME}-${env.BUILD_NUMBER}"

          def commitRange = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?
            "${env.GIT_PREVIOUS_SUCCESSFUL_COMMIT}..HEAD" :
            "HEAD~20..HEAD"

          def rawCommits = sh(
            script: """
              git log ${commitRange} --pretty=format:'%H|%an|%ae|%s'
            """,
            returnStdout: true
          ).trim()

          def commitList = []
          def authorSet = [] as Set

          if (rawCommits) {
            rawCommits.split("\\n").each { line ->
              def parts = line.split("\\|", 4)
              commitList << [
                commit_id: parts[0],
                author   : parts[1],
                email    : parts[2],
                message  : parts[3]
              ]
              authorSet << "${parts[1]} <${parts[2]}>"
            }
          }

          env.SHORT_COMMIT = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true
          ).trim()

          env.IMAGE_NAME = "narendrasivangula/node-js"
          env.IMAGE_TAG  = "${env.JOB_NAME}-${env.BUILD_NUMBER}-${env.SHORT_COMMIT}"

          def payload = [
            build_id     : env.BUILD_ID_TRACE,
            job_name     : env.JOB_NAME,
            build_number : env.BUILD_NUMBER.toInteger(),
            branch       : env.BRANCH_NAME,
            image_name   : env.IMAGE_NAME,
            image_tag    : env.IMAGE_TAG,
            commits      : commitList,
            authors      : authorSet.toList(),
            build_status : currentBuild.currentResult,
            timestamp    : new Date().format("yyyy-MM-dd'T'HH:mm:ssXXX")
          ]

          writeFile(
            file: 'build-metadata.json',
            text: groovy.json.JsonOutput.prettyPrint(
              groovy.json.JsonOutput.toJson(payload)
            )
          )
        }

        // ✅ CRITICAL
        stash name: 'build-metadata', includes: 'build-metadata.json'
      }
    }

    stage('Build & Push Docker Image') {
      steps {
        script {

          def safeJob = env.JOB_NAME.toLowerCase()
            .replaceAll("[^a-z0-9_.-]", "-")

          def shortCommit = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true
          ).trim()

          def imageTag = "${safeJob}-${env.BUILD_NUMBER}-${shortCommit}"

          podTemplate(yaml: """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: ["sleep"]
    args: ["999999"]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker
  volumes:
  - name: docker-config
    secret:
      secretName: dockerhub-creds-configjson
""") {

            node(POD_LABEL) {

              checkout scm

              // ✅ RESTORE METADATA FILE
              unstash 'build-metadata'

              container("kaniko") {

                def kanikoOutput = sh(
                  script: """
                    /kaniko/executor \
                      --dockerfile=${WORKSPACE}/Dockerfile \
                      --context=${WORKSPACE} \
                      --destination=narendra115c/node-js:${imageTag} \
                      --verbosity=info 2>&1
                  """,
                  returnStdout: true
                ).trim()

                echo "===== KANIKO OUTPUT ====="
                echo kanikoOutput

                env.IMAGE_DIGEST = sh(
                  script: """
                    echo '${kanikoOutput}' | grep -o 'sha256:[a-f0-9]\\{64\\}' | head -n 1
                  """,
                  returnStdout: true
                ).trim()

                if (!env.IMAGE_DIGEST) {
                  error "❌ IMAGE DIGEST NOT FOUND"
                }

                echo "✅ IMAGE DIGEST = ${env.IMAGE_DIGEST}"
              }

              // ✅ Inject digest OUTSIDE container block
              script {
                def jsonText = readFile('build-metadata.json')
                def json = new groovy.json.JsonSlurper().parseText(jsonText)
                json.image_digest = env.IMAGE_DIGEST

                writeFile(
                  file: 'build-metadata.json',
                  text: groovy.json.JsonOutput.prettyPrint(
                    groovy.json.JsonOutput.toJson(json)
                  )
                )
              }
            }
          }
        }
      }
    }

    stage('Store Metadata in OpenSearch') {
      steps {
        sh """
          curl -s -X POST \
            http://opensearch.observability.svc.cluster.local:9200/ci-build-metadata/_doc \
            -H 'Content-Type: application/json' \
            -d @build-metadata.json
        """
      }
    }
  }
}
