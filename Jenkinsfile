pipeline {
    agent any
    
    stages {
        stage('Build and Deploy') {
            steps {
                sh '''
                    echo "Starting Deployment to EastCoast HRMS..."
                    
                    # Ensure the directory exists
                    mkdir -p /opt/eastcoast-hrms
                    
                    # Sync files from Jenkins workspace to the deployment directory
                    rsync -a --exclude='.git' $WORKSPACE/ /opt/eastcoast-hrms/
                    
                    # Deploy using docker compose
                    cd /opt/eastcoast-hrms
                    docker compose up -d --build frontend backend
                    
                    echo "Deployment Successful!"
                '''
            }
        }
    }
}
