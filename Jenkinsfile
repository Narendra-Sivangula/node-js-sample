pipeline {

    agent any

    stages {

        // -----------------------------
        // Stage 1: Checkout Source
        // ----------------------------
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // ---------------------------------------
        // Stage 2: Capture Build Metadata
        // ---------------------------------------
        stage('Capture Build Metadata') {
            steps {
                script {

                    env.BUILD_ID_TRACE = "${env.JOB_NAME}-${env.BUILD_NUMBER}"

                    def commitRange = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?
                        "${env.GIT_PREVIOUS_SUCCESSFUL_COMMIT}..HEAD" :
                        "HEAD~20..HEAD"

                    def rawCommits = sh(
                        script: "git log ${commitRange} --pretty=format:'%H|%an|%ae|%s'",
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

                    env.IMAGE_NAME = "narendra115c/node-js"
                    def safeJob = env.JOB_NAME.toLowerCase().replaceAll("[^a-z0-9_.-]", "-")
                    env.IMAGE_TAG = "${safeJob}-${env.BUILD_NUMBER}-${env.SHORT_COMMIT}"


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

                stash name: 'build-metadata', includes: 'build-metadata.json'
            }
        }

        // ---------------------------------------
        // Stage 3: Build & Push Docker Image
        // ---------------------------------------
        stage('Build & Push Docker Image') {
            steps {
                script {

                    def safeJob = env.JOB_NAME.toLowerCase()
                        .replaceAll("[^a-z0-9_.-]", "-")

                    def shortCommit = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()

                    def imageTag = env.IMAGE_TAG

                    podTemplate(
                        yaml: """
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
"""
                    ) {

                        node(POD_LABEL) {

                            checkout scm
                            unstash 'build-metadata'

                            container("kaniko") {

                                def kanikoOutput = sh(
                                    script: """
/kaniko/executor \
  --dockerfile=${WORKSPACE}/Dockerfile \
  --context=${WORKSPACE} \
  --destination=${env.IMAGE_NAME}:${env.IMAGE_TAG} \
  --verbosity=info 2>&1
""",
                                    returnStdout: true
                                ).trim()

                                echo "===== KANIKO OUTPUT ====="
                                echo kanikoOutput

                                env.IMAGE_DIGEST = sh(
                                    script: """
echo '${kanikoOutput}' \
 | grep -o 'sha256:[a-f0-9]\\{64\\}' \
 | head -n 1
""",
                                    returnStdout: true
                                ).trim()

                                if (!env.IMAGE_DIGEST) {
                                    error "IMAGE DIGEST NOT FOUND"
                                }

                                echo "IMAGE DIGEST = ${env.IMAGE_DIGEST}"
                            }

                            // Inject digest into JSON
                            sh '''
tmp=$(mktemp)
head -n -1 build-metadata.json > $tmp
echo '  ,"image_digest": "'"$IMAGE_DIGEST"'"' >> $tmp
echo '}' >> $tmp
mv $tmp build-metadata.json
'''

                            echo "===== AFTER INJECTION ====="
                            sh "cat build-metadata.json"

                            // IMPORTANT: Re-stash updated file
                            stash name: 'build-metadata-updated', includes: 'build-metadata.json'
                        }
                    }
                }
            }
        }

stage("Update Deployment Repo") {
  steps {
    withCredentials([usernamePassword(
      credentialsId: 'Traceability',
      usernameVariable: 'GIT_USER',
      passwordVariable: 'GIT_TOKEN'
    )]) {

      sh '''
        rm -rf node-js-deployment

        git clone https://${GIT_USER}:${GIT_TOKEN}@github.com/Narendra-Sivangula/node-js-deployment.git
        cd node-js-deployment

        sed -i "s|image:.*|image: ${IMAGE_NAME}:${IMAGE_TAG}|" deployment.yaml

        git config user.email "narendrakumarsivangula@gmail.com"
        git config user.name "Narendra-Sivangula"

        git add deployment.yaml
        git commit -m "update image ${IMAGE_TAG}" || echo "No changes to commit"

        git push origin main
      '''
    }
  }
}


        

        // ---------------------------------------
        // Stage 4: Store Metadata in OpenSearch
        // ---------------------------------------
        stage('Store Metadata in OpenSearch') {
            steps {

                // Unstash updated metadata
                unstash 'build-metadata-updated'

                sh """
echo "===== FINAL METADATA ====="
cat build-metadata.json

curl -s -X POST \
  http://opensearch.observability.svc.cluster.local:9200/ci-build-metadata/_doc \
  -H 'Content-Type: application/json' \
  -d @build-metadata.json
"""
            }
        }
    }
}
