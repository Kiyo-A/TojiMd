

FROM quay.io/globaltechinfo/ultra-md:v3.9.1
RUN git clone https://github.com/Johanlieb34/TojiMd /root/TojiMd
WORKDIR /root/TojiMd
RUN npm install
EXPOSE 5000
CMD ["npm", "start"]
