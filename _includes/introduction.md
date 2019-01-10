The Kinesis Shard Calculator recommends the *optimal number of shards for a Kinesis data stream*, and shows the corresponding *cost estimation*. It also provides recommendations for improving the efficiency and lower the cost of the data stream.

An explanation for the various input attributes and results are provided within the Kinesis Shard Calculator itself. It should be pretty straight-forward. If not, please do provide feedback on our github project!

The background reasoning for the calculation of shards was the topic of a [breakout session at AWS re:Invent 2018](https://www.portal.reinvent.awsevents.com/connect/sessionDetail.ww?SESSION_ID=90058). You can see the [video of the session](https://www.youtube.com/watch?v=jKPlGznbfZ0) as well as the [presentation slides](https://www.slideshare.net/AmazonWebServices/high-performance-data-streaming-with-amazon-kinesis-best-practices-ant322r1-aws-reinvent-2018).

The diagram below depicts the bandwidth over 4 days of an actual Kinesis stream. It illustrates some of the main concepts:
![Bandwidth]({{ site.url }}/assets/bandwidth.png)
