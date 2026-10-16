pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'RUN_TRIVY', defaultValue: true, description: 'Scan images for CRITICAL vulnerabilities')
  }

  environment {
    AWS_REGION     = 'ap-south-1'
    AWS_ACCOUNT_ID = '123456789012'                      // change
    ECR_REGISTRY   = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    BACKEND_REPO   = "${ECR_REGISTRY}/wanderlust-backend"
    FRONTEND_REPO  = "${ECR_REGISTRY}/wanderlust-frontend"
    CLUSTER_NAME   = 'wanderlust-eks'                    // change
    NAMESPACE      = 'my-app'
    APP_DOMAIN     = 'wanderlust.yourdomain.com'         // change
    K8S_DIR        = 'k8s/base'
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        script {
          def sha = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${sha}"
          echo "Image tag: ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Install and test') {
      parallel {
        stage('Backend') {
          steps {
            dir('app/backend') {
              sh 'npm ci'
              sh 'npm test --if-present'
            }
          }
        }
        stage('Frontend') {
          steps {
            dir('app/frontend') {
              sh 'npm ci'
              sh 'npm test --if-present'
            }
          }
        }
      }
    }

    stage('Build images') {
      parallel {
        stage('Backend image') {
          steps {
            sh "docker build -t ${BACKEND_REPO}:${IMAGE_TAG} app/backend"
          }
        }
        stage('Frontend image') {
          steps {
            // VITE_API_PATH is baked in at build time, so it must be the public URL
            sh """
              docker build \
                --build-arg VITE_API_PATH=https://${APP_DOMAIN} \
                -t ${FRONTEND_REPO}:${IMAGE_TAG} app/frontend
            """
          }
        }
      }
    }

    stage('Scan images') {
      when { expression { params.RUN_TRIVY } }
      steps {
        sh "trivy image --exit-code 1 --severity CRITICAL --no-progress ${BACKEND_REPO}:${IMAGE_TAG}"
        sh "trivy image --exit-code 1 --severity CRITICAL --no-progress ${FRONTEND_REPO}:${IMAGE_TAG}"
      }
    }

    stage('Push to ECR') {
      when { branch 'main' }
      steps {
        withAws {
          sh '''
            aws ecr get-login-password --region $AWS_REGION | \
              docker login --username AWS --password-stdin $ECR_REGISTRY
          '''
          sh "docker push ${BACKEND_REPO}:${IMAGE_TAG}"
          sh "docker push ${FRONTEND_REPO}:${IMAGE_TAG}"
        }
      }
    }

    stage('Deploy to EKS') {
      when { branch 'main' }
      steps {
        withAws {
          sh 'aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME'
          sh 'kubectl config current-context'

          // Namespace first, then everything else (secrets come from External Secrets, not from Git)
          sh "kubectl apply -f ${K8S_DIR}/namespace.yml"
          sh "kubectl apply -R -f ${K8S_DIR}/"

          // Roll out the new images (container names must match your Deployments)
          sh "kubectl set image deployment/backend backend=${BACKEND_REPO}:${IMAGE_TAG} -n ${NAMESPACE}"
          sh "kubectl set image deployment/frontend-deployment frontend=${FRONTEND_REPO}:${IMAGE_TAG} -n ${NAMESPACE}"

          sh "kubectl rollout status deployment/backend -n ${NAMESPACE} --timeout=180s"
          sh "kubectl rollout status deployment/frontend-deployment -n ${NAMESPACE} --timeout=180s"
        }
      }
    }

    stage('Smoke test') {
      when { branch 'main' }
      steps {
        retry(5) {
          sleep time: 10, unit: 'SECONDS'
          sh "curl -fsS https://${APP_DOMAIN}/ > /dev/null"
          sh "curl -fsS https://${APP_DOMAIN}/api/posts > /dev/null"
        }
      }
    }
  }

  post {
    failure {
      script {
        if (env.BRANCH_NAME == 'main') {
          withAws {
            sh "kubectl rollout undo deployment/backend -n ${NAMESPACE} || true"
            sh "kubectl rollout undo deployment/frontend-deployment -n ${NAMESPACE} || true"
          }
        }
      }
    }
    always {
      sh 'docker image prune -f || true'
      cleanWs()
    }
  }
}

// Runs a block with AWS credentials stored in Jenkins (ID: aws-jenkins).
// If Jenkins runs on EC2 with an IAM role attached, remove the wrapper and use the role instead.
def withAws(Closure body) {
  withCredentials([[
    $class: 'AmazonWebServicesCredentialsBinding',
    credentialsId: 'aws-jenkins',
    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
  ]]) {
    body()
  }
}