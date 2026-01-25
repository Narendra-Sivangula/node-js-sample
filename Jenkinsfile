pipeline {
  agent any

  environment {
    BUILD_ID_CUSTOM = "${env.JOB_NAME}-${env.BUILD_NUMBER}"
  }
// Start of stages
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Extract Commit Metadata') {
      steps {
        script {
          env.GIT_COMMIT_ID = sh(
            script: "git rev-parse HEAD",
            returnStdout: true
          ).trim()

          env.GIT_AUTHOR = sh(
            script: "git show -s --format='%an <%ae>' HEAD",
            returnStdout: true
          ).trim()

          env.GIT_BRANCH_NAME = env.BRANCH_NAME

          echo """
          BUILD_ID      : ${env.BUILD_ID_CUSTOM}
          COMMIT_ID     : ${env.GIT_COMMIT_ID}
          AUTHOR        : ${env.GIT_AUTHOR}
          BRANCH        : ${env.GIT_BRANCH_NAME}
          """
        }
      }
    }
  }
}
