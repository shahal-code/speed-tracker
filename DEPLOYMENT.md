# AWS Hosting Guide: Speed Tester

To get the most accurate "proper MBPS speed", follow these steps to host your separated application on AWS.

## 1. Backend: AWS EC2 (The Speed Engine)
An EC2 instance provides dedicated network resources, making it far superior to Vercel for speed testing.

### Setup Steps:
1. **Launch Instance**: Go to the EC2 Dashboard and click **Launch Instance**.
   - **AMI**: Ubuntu Server 22.04 LTS.
   - **Instance Type**: `t3.micro` (free tier) or `t3.medium` (better performance).
2. **Security Group**: Add an **Inbound Rule** to allow Custom TCP on Port **3000** (or 80 if you use a reverse proxy). Also allow SSH (Port 22).
3. **Connect & Deploy**:
   - SSH into your instance.
   - Install Node.js:
     ```bash
     curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
     sudo apt-get install -y nodejs
     ```
   - Upload the `backend/` folder contents to the server.
   - Run `npm install`.
   - Start with PM2 (to keep it running):
     ```bash
     sudo npm install -g pm2
     pm2 start server.js --name speedtest-api
     ```
4. **Copy Public IP**: Save your EC2 instance's **Public IPv4 address**.

---

## 2. Frontend: AWS S3 + CloudFront (The UI)
Hosting the frontend on S3 is cost-effective and extremely fast.

### Setup Steps:
1. **S3 Bucket**: Create a bucket (e.g., `my-speed-tester-ui`).
   - Enable **Static Website Hosting**.
   - Set the index document to `index.html`.
2. **Update Config**: In your local `frontend/config.js`, update the URL:
   ```javascript
   window.BACKEND_URL = 'http://YOUR_EC2_PUBLIC_IP:3000';
   ```
3. **Upload Files**: Upload all files from the `frontend/` folder to the S3 bucket.
4. **CloudFront (Optional but Recommended)**: Create a CloudFront distribution pointing to your S3 bucket to get HTTPS and global CDN speed.

---

## Troubleshooting
- **CORS Errors**: If you get CORS errors, check the `backend/server.js`. By default, it's set to `*`. If you have a custom domain, you can set `ALLOWED_ORIGIN` in your environment variables on EC2.
- **Firewall**: Ensure the AWS Security Group allows inbound traffic on port 3000.
