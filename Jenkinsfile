pipeline {
  agent any

  stages {

    // =====================================================
    // 1. CHECKOUT SOURCE CODE
    // =====================================================
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // =====================================================
    // 2. CAPTURE BUILD METADATA
    // =====================================================
    stage('Capture Build Metadata') {
      steps {
        script {

          // Unique build trace ID
          env.BUILD_ID_TRACE = "${env.JOB_NAME}-${env.BUILD_NUMBER}"

          // Commit range logic
          def commitRange = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?
            "${env.GIT_PREVIOUS_SUCCESSFUL_COMMIT}..HEAD" :
            "HEAD~20..HEAD"

          // Extract commits
          def rawCommits = sh(
            script: "git log ${commitRange} --pretty=format:'%H|%an|%ae|%s'",
            returnStdout: true
          ).trim()

          def commitList = []
          def authorSet  = [] as Set

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

          // Short commit hash
          env.SHORT_COMMIT = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true
          ).trim()

          // Image name + tag
          env.IMAGE_NAME = "narendra115c/node-js"
          env.IMAGE_TAG  = "${env.JOB_NAME}-${env.BUILD_NUMBER}-${env.SHORT_COMMIT}"

          // Metadata payload JSON
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

          // Write metadata file
          writeFile(
            file: "build-metadata.json",
            text: groovy.json.JsonOutput.prettyPrint(
              groovy.json.JsonOutput.toJson(payload)
            )
          )

          echo "✅ build-metadata.json created successfully"
        }

        stash name: "build-metadata", includes: "build-metadata.json"
      }
    }

    // =====================================================
    // 3. BUILD & PUSH IMAGE USING KANIKO
    // =====================================================
    stage('Build & Push Docker Image') {
      steps {
        script {

          // Safe job name for Docker tag
          def safeJob = env.JOB_NAME.toLowerCase()
            .replaceAll("[^a-z0-9_.-]", "-")

          // Short commit again
          def shortCommit = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true
          ).trim()

          def imageTag = "${safeJob}-${env.BUILD_NUMBER}-${shortCommit}"

          // Pod template for Kaniko
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
              unstash "build-metadata"

              container("kaniko") {

                // Run Kaniko build
                def kanikoOutput = sh(
                  script: """
                    /kaniko/executor \
                      --dockerfile=${WORKSPACE}/Dockerfile \
                      --context=${WORKSPACE} \
                      --destination=${env.IMAGE_NAME}:${imageTag} \
                      --verbosity=info 2>&1
                  """,
                  returnStdout: true
                ).trim()

                echo "===== KANIKO OUTPUT ====="
                echo kanikoOutput

                // Extract digest
                env.IMAGE_DIGEST = sh(
                  script: """
                    echo '${kanikoOutput}' |
                    grep -o 'sha256:[a-f0-9]\\{64\\}' |
                    head -n 1
                  """,
                  returnStdout: true
                ).trim()

                if (!env.IMAGE_DIGEST) {
                  error "❌ IMAGE DIGEST NOT FOUND"
                }

                echo "✅ IMAGE DIGEST FOUND: ${env.IMAGE_DIGEST}"
              }

              // =====================================================
              // ✅ SAFE JSON UPDATE (NO sed, NO jq)
              // =====================================================
              script {
                def jsonText = readFile("build-metadata.json")
                def jsonObj  = new groovy.json.JsonSlurperClassic().parseText(jsonText)

                jsonObj.image_digest = env.IMAGE_DIGEST

                writeFile(
                  file: "build-metadata.json",
                  text: groovy.json.JsonOutput.prettyPrint(
                    groovy.json.JsonOutput.toJson(jsonObj)
                  )
                )

                echo "🧬 image_digest injected into build-metadata.json safely"
              }

              // Show final file
              sh "cat build-metadata.json"
            }
          }
        }
      }
    }

    // =====================================================
    // 4. STORE METADATA IN OPENSEARCH
    // =====================================================
    stage('Store Metadata in OpenSearch') {
      steps {
        sh """
          echo "===== FINAL METADATA PUSH TO OPENSEARCH ====="

          curl -s -X POST \
            http://opensearch.observability.svc.cluster.local:9200/ci-build-metadata/_doc \
            -H 'Content-Type: application/json' \
            -d @build-metadata.json

          echo "✅ Metadata stored successfully"
        """
      }
    }
  }
}
