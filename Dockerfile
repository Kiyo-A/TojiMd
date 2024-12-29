# Use the official Node.js 16 image as a base image
FROM node:16

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json files to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Expose the port the application will run on
EXPOSE 3000

# Define environment variable for Render or other hosting services
ENV PORT=3000

# Start the application
CMD ["npm", "start"]
