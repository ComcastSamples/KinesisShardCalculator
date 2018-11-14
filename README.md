# Introduction

The *Kinesis Shard Calculator* recommends the optimal number of shards for a Kinesis data stream, and shows the corresponding cost estimation. It also provides recommendations for improving the efficiency and lower the cost of the data stream.

See it in action here: https://comcastsamples.github.io/KinesisShardCalculator/

This repository contains the [Jekyll](https://jekyllrb.com/) site to display the Kinesis Shard Calculator in GitHub Pages. It leverages a GitHub Pages theme to make it pretty.

The main files are:
- `index.html` : The main and only web page. It puts all the other pieces together in a single HTML page.
- `_config.yml` : The Jekyll configuration file.
- `_includes/introduction.md` : The introduction displayed before the actual calculator.

The calculator itself is an [AngularJS](https://angularjs.org/) application. The application logic is contained in `_includes/KinesisShardsCalculator.js`, and the rendering of it is made in `_includes/KinesisShardsCalculator.html`, which uses `assets/css/styles.css` for styling.


# Development

In order to test it locally:

1. Clone this git repository
1. [Install Ruby](https://www.ruby-lang.org/en/documentation/installation/)
1. Install Jekyll:
```
gem install bundler jekyll
```
1. [Install github-pages bundle](https://help.github.com/articles/setting-up-your-github-pages-site-locally-with-jekyll/#step-2-install-jekyll-using-bundler)
1. Run a local Jekyll instance with: `jekyll serve`
1. Navigate with your favorite browser to: http://127.0.0.1:4000
