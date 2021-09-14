.PHONY: setup build deploy
TARGET = dev
HELM_EXPERIMENTAL_OCI=1
AWS_ACCOUNT=`aws sts get-caller-identity|jq .Account -r -c`

setup:
	export GO111MODULE=on
	go mod vendor
	go get github.com/aws/aws-lambda-go/cmd/build-lambda-zip
	cdk8s import
build: 
	export GO111MODULE=on
	for module_dir in $$(ls lib/functions | grep -v lib); do\
	  echo  "building start... $${module_dir}";\
	  	cd lib/functions/$${module_dir};\
		pwd;\
		mkdir -p bin;\
		env GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/main main.go || exit 1;\
		zip bin/main.zip bin/main;\
		cd ../../..;\
	  echo  "building finished. $${module_dir}";\
	done
deploy:
	cdk deploy --all --require-approval never
up:
	aws lambda update-function-code --function-name notisce-subscribe --zip-file fileb://lib/functions/subscribe/bin/main.zip --publish
ecr:
	aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin `aws sts get-caller-identity|jq .Account -r -c`.dkr.ecr.us-east-1.amazonaws.com
build-container:
	docker build -t notisce-subscriber .
push-container:
	docker tag notisce-subscriber atatur9/notisce:latest
	docker push atatur9/notisce:latest
helm-pull:
	helm chart pull ${AWS_ACCOUNT}.dkr.ecr.us-east-1.amazonaws.com/notisce:latest
