<!--
    An AngularJS web application to help with Kinesis Stream sizing - i.e. deciding/adjusting the number of shards.

    Terminology: We use "bandwidth" to measure bytes per second and "throughput" to measure events per second.

    Programnming note: We do all bandwidth computations in bytes/s, and only
    convert to MB/s, GB/s or TB/s when displaying the data.
-->
  <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js"></script>
  <script type="text/javascript">
  var app = angular.module("KinesisShardsCalculator", []);

  // Form validation functions
  function isGreater(n, min){
    return n >= min
  }
  function inRange(n, min, max){
    return n >= min && n <= max
  }

  app.service('Producer', function() {
    // AWS limits
    this.awsMaxRecordsPerSec = 1000 // Maximum number of records per second per shard
    this.awsMaxIncomingBw = Math.pow(1024, 2) // Maximum number of incoming bytes per second per shard
    this.awsMaxOutgoingBw = 2 * Math.pow(1024, 2) // Maximum number of outgoing bytes per second per shard
    //
    // Producer parameters
    //
    // Message size
    this.messageSize = 200 // Average message size in the data stream
    this.messageSizeMin = 1 // Minimum acceptable average message size
    this.messageSizeMax = Math.pow(1024, 2) // Maximum acceptable average message size, per Kinesis limit
    this.messageSizeInvalid = function () {
      return !inRange(this.messageSize, this.messageSizeMin, this.messageSizeMax)
    }
    // Record aggregation
    this.recordAggregation = false // true if the producer is using record aggregation, false otherwise
    // Average throughput / bandwidth
    this.averageInThroughput = 10000 // Average incoming throughput throughout the day
    this.averageInThroughputInvalid = function(){
      return !isGreater(this.averageInThroughput, 1)
    }
    this.adjustPeakThroughput = function() {
      if(this.averageInThroughput > this.peakInThroughput)
        this.peakInThroughput = this.averageInThroughput
      if(this.averageInThroughput > this.surgeThroughput)
        this.surgeThroughput = this.averageInThroughput
    }
    this.averageInBandwidth = function() {
      // Average incoming bandwidth throughout the day
      return this.averageInThroughput * this.messageSize;
    }
    // Peak throughput / bandwidth
    this.peakInThroughput = 20000 // Peak incoming throughput. It's not necessarily the maximum throughput because there can be surge traffic
    // In other words, that's the maximum throughput not considering the traffic surges.
    this.peakInThroughputInvalid = function(){
      return !isGreater(this.peakInThroughput, Math.max(1, this.averageInThroughput))
    }
    this.adjustSurgeThroughput = function() {
      if(this.peakInThroughput > this.surgeThroughput)
        this.surgeThroughput = this.peakInThroughput
    }
    this.peakInBandwidth = function() {
      // Peak incoming bandwidth (i.e. the max incoming bandwidth if we don't consider traffic surges)
      return this.peakInThroughput * this.messageSize
    }
    // Surge information
    this.hasSurge = false // true if the data streams
    this.surgeThroughput = 50000 // Maximum throughput during surge
    this.surgeThroughputInvalid = function(){
      return !isGreater(this.surgeThroughput, Math.max(1, this.peakInThroughput))
    }
    this.surgeInBandwidth = function() {
      return this.surgeThroughput * this.messageSize
    }
    this.surgeDuration = 10 // Duration of the surge, in seconds
    this.surgeDurationInvalid = function(){
      return !isGreater(this.surgeDuration, 1)
    }
    // Shards needed
    this.shardsFromPeakInBandwidth = function(){
      // Shards needed because of the peak bandwith, considering the AWS shard input bandhwitdh
      return Math.ceil(this.peakInBandwidth() / this.awsMaxIncomingBw)
    }
    this.shardsFromPeakInThroughput = function(){
      // Shards needed because of the peak throughput, considering the AWS shard max records per sec
      return Math.ceil(this.peakInThroughput / this.awsMaxRecordsPerSec)
    }
    this.shardsFromSurgeInBandwidth = function(){
      // Shards needed because of the surge bandwith, considering the AWS shard input bandhwitdh
      return Math.ceil(this.surgeInBandwidth() / this.awsMaxIncomingBw)
    }
    this.shardsFromSurgeInThroughput = function(){
      // Shards needed because of the surge throughput, considering the AWS shard max records per sec
      return Math.ceil(this.surgeThroughput / this.awsMaxRecordsPerSec)
    }
  })

  app.service('AWSPricing', function($http) {
    // TODO: we may be able to simplify getting the prices, by only asking for the AWS region and
    // retrieving the list prices using: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonKinesis/current/index.json
    this.shardHour = .015
    this.shardHourMin = 0.001
    this.shardHourMax = 0.1
    this.shardHourInvalid = function(){
      return !inRange(this.shardHour, this.shardHourMin, this.shardHourMax)
    }
    this.putUnits = .014
    this.putUnitsMin = 0.001
    this.putUnitsMax = 0.1
    this.putUnitsInvalid = function(){
      return !inRange(this.putUnits, this.putUnitsMin, this.putUnitsMax)
    }
    this.shardExHour = .02
    this.shardExHourMin = 0.001
    this.shardExHourMax = 0.1
    this.shardExHourInvalid = function(){
      return !inRange(this.shardExHour, this.shardExHourMin, this.shardExHourMax)
    }
    this.fanoutShard = .015
    this.fanoutShardMin = 0.001
    this.fanoutShardMax = 0.1
    this.fanoutShardInvalid = function(){
      return !inRange(this.fanoutShard, this.fanoutShardMin, this.fanoutShardMax)
    }
    this.fanoutData = .013
    this.fanoutDataMin = 0.001
    this.fanoutDataMax = 0.1
    this.fanoutDataInvalid = function(){
      return !inRange(this.fanoutData, this.fanoutDataMin, this.fanoutDataMax)
    }
    // AWS discount
    this.discount = 0 // Discount the user account has on top of AWS list prices
    this.discountMin = 0 // Minimum discount
    this.discountMax = 100 // Maximum discount
    this.discountInvalid = function(){
      return !inRange(this.discount, this.discountMin, this.discountMax)
    }
  })

  app.controller("ShardsCtrl", function($scope, Producer, AWSPricing) {

    // Utility functions
    $scope.bytesToMB = function (n) {
      return n / Math.pow(1024, 2)
    }
    $scope.prettify = function(n){
      return n.toFixed(2)
    }
    $scope.prettifyBytes = function(bytes) {
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes == 0) return '0 B';
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        if(i>4) i=4 // Not going beyond TB
        return this.prettify(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    // Producer service
    $scope.Producer = Producer

    //
    // Consumer
    //
    // Consumer factory
    baseConsumer = function() {
      return {
        // Use enhanced fan-out consumption
        enhancedFanOut: false,
        // Maximum consumption speed
        maxConsumptionSpeed: 1000, // Maximum number of events that the consumer can process per second per shard
        maxConsumptionSpeedInvalid: function(){
          return !isGreater(this.maxConsumptionSpeed, 1)
        },
        // Maximum acceptable latency
        maxAcceptableLatency: 30, // Consumer SLA related to the maximum latency of the data processing
        maxAcceptableLatencyInvalid: function(){
          return !isGreater(this.maxAcceptableLatency, 1)
        },
        // Shards needed
        shardsFromMaxOutThroughput: function(){
          return Math.ceil(Producer.peakInThroughput / this.maxConsumptionSpeed)
        },
        shardsFromMaxAcceptableLatency: function(){
          if(!Producer.hasSurge)
            return 0
          throughput = Math.ceil((Producer.surgeThroughput * Producer.surgeDuration + Producer.peakInThroughput * this.maxAcceptableLatency)
             / (this.maxConsumptionSpeed * (Producer.surgeDuration + this.maxAcceptableLatency)))
          if(this.enhancedFanOut){
            // For fanout consumers, the bandwidth is never a limitation
            bandwidth = 0
          } else {
            // For the bandwidth consideration, we only count the "standard" consumer, because fan-out consumers do not share the bandwitdh with the "standard" consumers
            bandwidth = Math.ceil(Producer.messageSize * $scope.nbStandardConsumers() * (Producer.surgeThroughput * Producer.surgeDuration + Producer.peakInThroughput * this.maxAcceptableLatency)
              / (Producer.awsMaxOutgoingBw * (Producer.surgeDuration + this.maxAcceptableLatency)))
            }
          return Math.max(throughput, bandwidth)
        }
      }
    }
    // Actual list of consumers
    $scope.consumers = {
      1: baseConsumer()
    }
    $scope.nbConsumers = function(){
      return Object.keys($scope.consumers).length
    }
    $scope.nbStandardConsumers = function(){
      // Return the number of "regular" consumers (i.e. not counting enhanced fan-out consumers)
      var i = 0
      for(key in $scope.consumers) {
        if(!$scope.consumers[key].enhancedFanOut)
          i++
      }
      return i
    }
    // Consumer management functions
    $scope.addConsumer = function(id) {
      $scope.consumers[id + 1] = baseConsumer()
    }
    $scope.removeConsumer = function(id) {
      var size = 1;
      var newConsumerMap = {}
      for(key in $scope.consumers) {
          if(key != id){
            newConsumerMap[size]=$scope.consumers[key]
            size++
          }
      }
      $scope.consumers = newConsumerMap
    }
    // Shards needed
    $scope.shardsFromNbConsumers = function(){
      return Math.ceil($scope.nbStandardConsumers() * Producer.averageInBandwidth() / Producer.awsMaxOutgoingBw)
    }
    $scope.totalShardsWithAggregation = function(){
      // Shards needed from producer
      var shards = Math.max(
        Producer.shardsFromPeakInBandwidth(),
        $scope.shardsFromNbConsumers())
        if(Producer.hasSurge)
          shards = Math.max(shards, Producer.shardsFromSurgeInBandwidth())
      // Shards needed from the consumers
      for(key in $scope.consumers){
          shards = Math.max(shards, $scope.consumers[key].shardsFromMaxOutThroughput())
          if(Producer.hasSurge)
            shards = Math.max(shards, $scope.consumers[key].shardsFromMaxAcceptableLatency())
      }
      return shards
    }
    $scope.totalShardsWithoutAggregation = function(){
      // Shards needed from producer
      var shards = Math.max(
        Producer.shardsFromPeakInBandwidth(),
        Producer.shardsFromPeakInThroughput(),
        $scope.shardsFromNbConsumers())
      if(Producer.hasSurge)
        shards = Math.max(shards,
          Producer.shardsFromSurgeInBandwidth(),
          Producer.shardsFromSurgeInThroughput())
      // Shards needed from the consumers
      for(key in $scope.consumers){
          shards = Math.max(shards, $scope.consumers[key].shardsFromMaxOutThroughput())
          if(Producer.hasSurge)
            shards = Math.max(shards, $scope.consumers[key].shardsFromMaxAcceptableLatency())
      }
      return shards
    }
    $scope.totalShards = function() {
      if(Producer.recordAggregation)
        return $scope.totalShardsWithAggregation()
      return $scope.totalShardsWithoutAggregation()
    }

    //
    // Pricing
    //
    $scope.AWSPricing = AWSPricing
    // Retention period
    $scope.retentionPeriod = 24 // Kinesis data stream retention period
    $scope.retentionPeriodMin = 24 // Minimum data stream retention period based on Kinesis limits
    $scope.retentionPeriodMax = 168 // Maximum data stream retention period based on Kinesis limits
    $scope.retentionInvalid = function(){
      return !inRange($scope.retentionPeriod, $scope.retentionPeriodMin, $scope.retentionPeriodMax)
    }
    // Price and savings computation
    $scope.shardPriceWithoutAggregation = function() {
      return $scope.totalShardsWithoutAggregation() * ( 24 * AWSPricing.shardHour + ($scope.retentionPeriod - 24) * AWSPricing.shardExHour ) * (1 - AWSPricing.discount / 100)
    }
    $scope.shardPriceWithAggregation = function() {
      return $scope.totalShardsWithAggregation() * ( 24 * AWSPricing.shardHour + ($scope.retentionPeriod - 24) * AWSPricing.shardExHour ) * (1 - AWSPricing.discount / 100)
    }
    $scope.shardPrice = function() {
      if(Producer.recordAggregation)
        return $scope.shardPriceWithAggregation()
      return $scope.shardPriceWithoutAggregation()
    }
    $scope.putPriceWithoutAggregation = function(){
      // Without record aggregation, we compute the PUT price for each message produced
      return Producer.averageInThroughput * Math.ceil(Producer.messageSize / (25*1024)) * 3600 * 24 * AWSPricing.putUnits / 1000000 * (1 - AWSPricing.discount / 100)
    }
    $scope.putPriceWithAggregation = function(){
      // With record aggregation, we copute the PUT price for groups of messages produced per second per shards. This is assuming that the traffic is evenly distributed.
      return Math.ceil(Producer.averageInBandwidth() / ((25*1024) * $scope.totalShards())) * $scope.totalShards() * 3600 * 24 * AWSPricing.putUnits / 1000000 * (1 - AWSPricing.discount / 100)
    }
    $scope.putPrice = function(){
      if(Producer.recordAggregation)
        return $scope.putPriceWithAggregation()
      return $scope.putPriceWithoutAggregation()
    }
    $scope.aggregationSavings = function(){
      return $scope.shardPriceWithoutAggregation() + $scope.putPriceWithoutAggregation() - $scope.shardPriceWithAggregation() - $scope.putPriceWithAggregation()
    }
    $scope.fanoutShardPrice = function(){
      return $scope.totalShards() * 24 * AWSPricing.fanoutShard * (1 - AWSPricing.discount / 100)
    }
    $scope.fanoutDataPrice = function(){
        return Producer.averageInBandwidth() * 3600 * 24 * AWSPricing.fanoutData / Math.pow(1024, 3) * (1 - AWSPricing.discount / 100)
    }
    $scope.fanoutPrice = function(){
      return $scope.fanoutShardPrice() + $scope.fanoutDataPrice()
    }
  })
  </script>
