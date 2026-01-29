pipeline {
    agent none

    environment {
        REGISTRY = "docker.io"
        IMAGE_NAME = "narendra115c/node-js"
    }

    stages {

        stage('Checkout') {
            agent any
            steps {
                checkout scm
            }
        }

        stage('Capture Build Metadata') {
            agent any
            steps {
                script {
                    def commitId = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()

                    def author = sh(
                        script: "git log -1 --pretty=format:'%an'",
                        returnStdout: true
                    ).trim()

                    def message = sh(
                        script: "git log -1 --pretty=format:'%s'",
                        returnStdout: true
                    ).trim()

                    writeFile file: 'build-metadata.json', text: """
                    {
                      "commit": "${commitId}",
                      "author": "${author}",
                      "message": "${message}",
                      "job": "${env.JOB_NAME}",
                      "build": "${env.BUILD_NUMBER}"
                    }
                    """

                    stash includes: 'build-metadata.json', name: 'metadata'
                }
            }
        }

        stage('Build & Push Docker Image') {
            agent {
                kubernetes {
                    yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command:
    - sleep
    args:
    - "999999"
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker
  volumes:
  - name: docker-config
    secret:
      secretName: dockerhub-creds-configjson
"""
                }
            }

            steps {
                container('kaniko') {
                    script {
                        def shortCommit = sh(
                            script: "git rev-parse --short HEAD",
                            returnStdout: true
                        ).trim()

                        def tag = "${env.BRANCH_NAME}-${env.BUILD_NUMBER}-${shortCommit}"

                        sh """
                        /kaniko/executor \
                          --dockerfile=Dockerfile \
                          --context=`pwd` \
                          --destination=${IMAGE_NAME}:${tag} \
                          --verbosity=info
                        """

                        echo "Image pushed: ${IMAGE_NAME}:${tag}"
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Build Successful ✅"
        }
        failure {
            echo "Build Failed ❌"
        }
    }
}
