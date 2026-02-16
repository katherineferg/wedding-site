const path = require("path");

module.exports = {
  plugins: [
    require("postcss-import"),
    require("@csstools/postcss-global-data")({
      files: [path.resolve(__dirname, "@styles/variables/_media.pcss")],
    }),
    require("postcss-custom-media")(),
    require("postcss-nested")({
      preserveEmpty: false,
    }),
    require("postcss-each"),
    require("autoprefixer"),
  ],
};
