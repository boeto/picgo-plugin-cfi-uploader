import picgo from 'picgo';

export = (ctx) => {
  const config = (ctx) => {
    let userConfig = ctx.getConfig('picBed.cloudflare-images-uploader');
    if (!userConfig) {
      userConfig = {};
    }
    const config = [
      {
        name: 'accountId',
        type: 'input',
        default: userConfig.accountId || '',
        message: 'accountId is required',
        required: true,
      },
      {
        name: 'apiToken',
        type: 'input',
        default: userConfig.apiToken || '',
        message: 'apiToken is required',
        required: true,
      },
      {
        name: 'variantName',
        type: 'input',
        default: userConfig.variantName || 'public',
        message: 'variantName is required (default: public)',
        required: true,
      },
    ];
    return config;
  };

  const postOptions = (
    accountId: string,
    apiToken: string,
    fileName: string,
    image: Buffer
  ) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;

    const headers = {
      contentType: 'multipart/form-data',
      Authorization: `Bearer ${apiToken}`,
      'User-Agent': 'PicGo',
    };
    let formData = {};
    const opts = {
      method: 'POST',
      url: url,
      headers: headers,
      formData: formData,
    };
    opts.formData['file'] = {};
    opts.formData['file'].value = image;
    opts.formData['file'].options = {
      filename: fileName,
    };
    return opts;
  };

  const handle = async (ctx) => {
    let cloudflareImagesOptions = ctx.getConfig(
      'picBed.cloudflare-images-uploader'
    );
    if (!cloudflareImagesOptions) {
      throw new Error("Can't find cloudflare-images-uploader config");
    }
    const accountId: string = cloudflareImagesOptions.accountId;
    const apiToken: string = cloudflareImagesOptions.apiToken;
    const variantName: string = cloudflareImagesOptions.variantName;
    try {
      let imgList = ctx.output;
      for (let i in imgList) {
        let image = imgList[i].buffer;
        if (!image && imgList[i].base64Image) {
          image = Buffer.from(imgList[i].base64Image, 'base64');
        }
        const postConfig = postOptions(
          accountId,
          apiToken,
          imgList[i].fileName,
          image
        );
        let body = await ctx.Request.request(postConfig);
        delete imgList[i].base64Image;
        delete imgList[i].buffer;
        body = JSON.parse(body);
        if (body.success) {
          const imgUrl = body.result.variants;
          const variantIndex = imgUrl.findIndex(function (value: string) {
            const valueArr = value.split('/');
            const valueEnd = valueArr.slice(-1);
            return valueEnd[0] === variantName;
          });
          if (variantIndex !== -1) {
            imgList[i]['imgUrl'] = imgUrl[variantIndex];
          } else {
            throw new Error('Cannot match Variant Name');
          }
        } else {
          throw new Error('Upload failed');
        }
      }
      return ctx;
    } catch (err) {
      if (err.error === 'Cannot match Variant Name') {
        ctx.emit('notification', {
          title: 'Cannot match Variant Name',
          body: 'Please check the Variant Name settings',
        });
      } else {
        ctx.emit('notification', {
          title: 'Upload failed',
          body: 'Please check your configuration',
        });
      }
      throw err;
    }
  };

  const register = () => {
    ctx.helper.uploader.register('cloudflare-images-uploader', {
      name: 'CFI图床',
      handle,
      config: config,
    });
  };

  return {
    uploader: 'cloudflare-images-uploader',
    register,
  };
};
