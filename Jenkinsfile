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

          // Determine commit range
          def commitRange = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?
            "${env.GIT_PREVIOUS_SUCCESSFUL_COMMIT}..HEAD" :
            "HEAD~20..HEAD"

          // Collect commits
          def rawCommits = sh(
            script: """
              git log ${commitRange} \
              --pretty=format:'%H|%an|%ae|%s'
            """,
            returnStdout: true
          ).trim()

          def commitList = []
          def authorSet = [] as Set

          if (rawCommits) {
            rawCommits.split("\\n").each { line ->
              def parts = line.split("\\|", 4)
              def commitObj = [
                commit_id: parts[0],
                author: parts[1],
                email: parts[2],
                message: parts[3]
              ]
              commitList << commitObj
              authorSet << "${parts[1]} <${parts[2]}>"
            }
          }

          // Image metadata (must match Build & Push stage)
      env.SHORT_COMMIT = sh(
      script: "git rev-parse --short HEAD",
      returnStdout: true  
    ).trim()

    env.IMAGE_TAG = "${env.JOB_NAME}-${env.BUILD_NUMBER}-${env.SHORT_COMMIT}"
    env.IMAGE_NAME = "narendrasivangula/node-js"


          def payload = [
            build_id    : env.BUILD_ID_TRACE,
            job_name    : env.JOB_NAME,
            build_number: env.BUILD_NUMBER.toInteger(),
            branch      : env.BRANCH_NAME,
            image_name   : env.IMAGE_NAME,
            image_tag    : env.IMAGE_TAG,
            commits     : commitList,
            authors     : authorSet.toList(),
            build_status: currentBuild.currentResult,
            timestamp   : new Date().format("yyyy-MM-dd'T'HH:mm:ssXXX")
          ]

          writeFile(
            file: 'build-metadata.json',
            text: groovy.json.JsonOutput.prettyPrint(
              groovy.json.JsonOutput.toJson(payload)
            )
          )
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
    image: gcr.io/kaniko-project/executor:latest
    command:
      - /kaniko/executor
    args:
      - --dockerfile=Dockerfile
      - --context=dir:///workspace
      - --destination=${IMAGE_NAME}
    volumeMounts:
      - name: workspace-volume
        mountPath: /home/jenkins/agent/workspace
      - name: docker-config
        mountPath: /kaniko/.docker
    workingDir: /workspace
  volumes:
  - name: docker-config
    secret:
      secretName: dockerhub-creds
"""
    }
  }
  steps {
    container('kaniko') {
      sh 'echo "Building and pushing image via Kaniko"'
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
