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
          env.COMMIT_ID = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
          env.COMMIT_MESSAGE = sh(script: "git log -1 --pretty=%B", returnStdout: true).trim()
          env.AUTHOR = sh(script: "git show -s --format='%an <%ae>' HEAD", returnStdout: true).trim()

          def payload = [
            build_id: env.BUILD_ID_TRACE,
            job_name: env.JOB_NAME,
            build_number: env.BUILD_NUMBER.toInteger(),
            branch: env.BRANCH_NAME,
            commit_id: env.COMMIT_ID,
            commit_message: env.COMMIT_MESSAGE,
            author: env.AUTHOR,
            build_status: currentBuild.currentResult,
            timestamp: new Date().format("yyyy-MM-dd'T'HH:mm:ssXXX")
          ]

          writeFile file: 'build-metadata.json',
            text: groovy.json.JsonOutput.toJson(payload)
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
