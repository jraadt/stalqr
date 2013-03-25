# STALQR

## Steps to build

* Download source
* npm install
* It's recommended to change the toBuffer() method in Matrix.cc to lower the quality of the jpeg.  Improves speed.  For example:

Change
  std::vector<int> params(0);//CV_IMWRITE_JPEG_QUALITY 90

To  
  int p[] = {1,50,0};
  std::vector<int> params (p, p + sizeof(p) / sizeof(int) );


## Use

* Start server.js.
* Go to http://localhost:9000.
* Only tested in the newest Chrome.
* Click on a face to identify it.  Type in a name and press enter.


## License

The library is distributed under the MIT License

