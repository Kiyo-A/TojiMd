FROM quay.io/gurusensei/gurubhay:latest

RUN git clone https://github.com/Johanlieb34/TojiMd/root/index

WORKDIR /root/index/

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
