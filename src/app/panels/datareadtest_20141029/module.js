/** @scratch /panels/5
 *
 * include::panels/datareadtest_20141029.asciidoc[]
 */

/** @scratch /panels/datareadtest_20141029/0
 *
 * == datareadtest_20141029
 * Status: *Stable*
 *
 * A table, bar chart or pie chart based on the results of an Elasticsearch terms facet.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'kbn'
],
function (angular, app, _, $, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.datareadtest_20141029', []);
  app.useModule(module);

  module.controller('datareadtest_20141029', function($scope, querySrv, dashboard, filterSrv, fields) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      status  : "Stable",
      description : "Displays the results of an elasticsearch facet as a pie chart, bar chart, or a "+
        "table"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/datareadtest_20141029/5
       * === Parameters
       *
       * field:: The field on which to computer the facet
       */
      field   : '_type',
      /** @scratch /panels/datareadtest_20141029/5
       * exclude:: terms to exclude from the results
       */
      exclude : [],
      /** @scratch /panels/datareadtest_20141029/5
       * size:: Show this many terms
       */
      size    : 10,
      /** @scratch /panels/datareadtest_20141029/5
       * order:: In terms mode: count, term, reverse_count or reverse_term,
       * in terms_stats mode: term, reverse_term, count, reverse_count,
       * total, reverse_total, min, reverse_min, max, reverse_max, mean or reverse_mean
       */
      order   : 'count',
      /** @scratch /panels/datareadtest_20141029/5
       * spyable:: Set spyable to false to disable the inspect button
       */
      spyable     : true,
      /** @scratch /panels/datareadtest_20141029/5
       *
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      }
    };

    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.get_data = function() {
      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      $scope.panelMeta.loading = true;
      var request,
        results,
        boolQuery,
        queries;

      $scope.field = _.contains(fields.list,$scope.panel.field+'.raw') ?
        $scope.panel.field+'.raw' : $scope.panel.field;

      request = $scope.ejs.Request().indices(dashboard.indices);

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });
      var __timefield = 'Timestamp';
      var __axis1 = 'Timestamp';
      var __axis2 = 'City_Source';
      var __axis2 = 'City_Target';

      $scope.daysOfInterest = ['2014-03-10', '2014-03-11', '2014-03-12', '2014-03-13', '2014-03-14', '2014-10-01', '2014-10-02', '2014-10-03', '2014-10-04', '2014-10-05'];//, '2014-03-11', '2014-03-12', '2014-03-13', '2014-03-14'];

      var request1 = $scope.ejs.Request().indices(dashboard.indices);
      request1 = request1
          .facet(
              $scope.ejs.TermsFacet(__axis1)
              .field(__axis1)
              .size($scope.panel.size)
              .order($scope.panel.order)
              .exclude($scope.panel.exclude)
              .facetFilter(
                      $scope.ejs.AndFilter(
                          [
                              $scope.ejs.QueryFilter(
                                  $scope.ejs.FilteredQuery(
                                      boolQuery,
                                      filterSrv.getBoolFilter(filterSrv.ids())
                                  )
                              )
                          ]
                      )
                  )
              );

      if ($scope.panel.numberOfAxis >= 3) {
          request1 = request1
              .facet(
                  $scope.ejs.TermsFacet(__axis2)
                  .field(__axis2)
                  .size($scope.panel.size)
                  .order($scope.panel.order)
                  .exclude($scope.panel.exclude)
                  .facetFilter(
                          $scope.ejs.AndFilter(
                              [
                                  $scope.ejs.QueryFilter(
                                      $scope.ejs.FilteredQuery(
                                          boolQuery,
                                          filterSrv.getBoolFilter(filterSrv.ids())
                                      )
                                  )
                              ]
                          )
                      )
                  )
              .facet(
                  $scope.ejs.TermsFacet(__axis3)
                  .field(__axis3)
                  .size($scope.panel.size)
                  .order($scope.panel.order)
                  .exclude($scope.panel.exclude)
                  .facetFilter(
                          $scope.ejs.AndFilter(
                              [
                                  $scope.ejs.QueryFilter(
                                      $scope.ejs.FilteredQuery(
                                          boolQuery,
                                          filterSrv.getBoolFilter(filterSrv.ids())
                                      )
                                  )
                              ]
                          )
                      )
                  );
      }
      var results1 = request1.doSearch().then(function (results1) {
          var axis1Labels = [];
          var axis2Labels = [];
          var axis3Labels = [];

          _.each(results1.facets[__axis1].terms, function (v) {
              axis1Labels.push(v.term);
          });

          $scope.daysOfInterest.forEach(function (day) {
              axis1Labels.forEach(function (sourceNode) {
                  request = request
                  .facet(
                      $scope.ejs.TermsFacet(day + '~/-#--#-/~' + __axis1 + '~/-#--#-/~' + __axis2 + '~/-#--#-/~' + sourceNode)
                      .field(__axis2)
                      .size($scope.panel.size)
                      .order($scope.panel.order)
                      .exclude($scope.panel.exclude)
                      .facetFilter(
                              $scope.ejs.AndFilter(
                                  [
                                      $scope.ejs.QueryFilter(
                                          $scope.ejs.FilteredQuery(
                                              boolQuery,
                                              filterSrv.getBoolFilter(filterSrv.ids())
                                          )
                                      ),
                                      $scope.ejs.QueryFilter(
                                          $scope.ejs.TermQuery(
                                              __axis1,
                                              sourceNode
                                          )
                                      ),
                                      $scope.ejs.QueryFilter(
                                          $scope.ejs.TermQuery(
                                              'Timestamp',
                                              day
                                          )
                                      )
                                  ]
                              )
                          )
                      );
              });

              if ($scope.panel.numberOfAxis >= 3) {
                  _.each(results1.facets[__axis2].terms, function (v) {
                      axis2Labels.push(v.term);
                  });
                  _.each(results1.facets[__axis3].terms, function (v) {
                      axis3Labels.push(v.term);
                  });
                  axis2Labels.forEach(function (sourceNode) {
                      request = request
                      .facet(
                          $scope.ejs.TermsFacet(day + '~/-#--#-/~' + __axis2 + '~/-#--#-/~' + __axis3 + '~/-#--#-/~' + sourceNode)
                          .field(__axis3)
                          .size($scope.panel.size)
                          .order($scope.panel.order)
                          .exclude($scope.panel.exclude)
                          .facetFilter(
                                  $scope.ejs.AndFilter(
                                      [
                                          $scope.ejs.QueryFilter(
                                              $scope.ejs.FilteredQuery(
                                                  boolQuery,
                                                  filterSrv.getBoolFilter(filterSrv.ids())
                                              )
                                          ),
                                          $scope.ejs.QueryFilter(
                                              $scope.ejs.TermQuery(
                                                  __axis2,
                                                  sourceNode
                                              )
                                          ),
                                          $scope.ejs.QueryFilter(
                                              $scope.ejs.TermQuery(
                                                  'Timestamp',
                                                  day
                                              )
                                          )
                                      ]
                                  )
                              )
                          );
                  });
                  axis3Labels.forEach(function (sourceNode) {
                      request = request
                      .facet(
                          $scope.ejs.TermsFacet(day + '~/-#--#-/~' + __axis3 + '~/-#--#-/~' + __axis1 + '~/-#--#-/~' + sourceNode)
                          .field(__axis1)
                          .size($scope.panel.size)
                          .order($scope.panel.order)
                          .exclude($scope.panel.exclude)
                          .facetFilter(
                                  $scope.ejs.AndFilter(
                                      [
                                          $scope.ejs.QueryFilter(
                                              $scope.ejs.FilteredQuery(
                                                  boolQuery,
                                                  filterSrv.getBoolFilter(filterSrv.ids())
                                              )
                                          ),
                                          $scope.ejs.QueryFilter(
                                              $scope.ejs.TermQuery(
                                                  __axis3,
                                                  sourceNode
                                              )
                                          ),
                                          $scope.ejs.QueryFilter(
                                              $scope.ejs.TermQuery(
                                                  'Timestamp',
                                                  day
                                              )
                                          )
                                      ]
                                  )
                              )
                          );
                  });
              }
          });                   
                    

          // Populate the inspector panel; The current request will be shown in the inspector panel
          $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

          // Populate scope when we have results
          results = request.doSearch().then(function (results) {
              $scope.panelMeta.loading = false;
              $scope.hits = results.hits.total;

              $scope.results = results;
              $scope.$emit('render'); //dispatches the event upwards through the scope hierarchy of controllers.
          });
      });
    };

    $scope.build_search = function(term,negate) {
      
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
      $scope.$emit('render');
    };
  });

  module.directive('datareadtest_20141029Chart', function(querySrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {
        var plot;

        // Receive render events
        scope.$on('render',function(){
          render_panel();
        });

        function build_results() {
            console.log("JH");
            var k = 0;
            //the result data (the data how we need them to draw the network diagram are now saved in the array 'scope.data'
            scope.data = [];

            scope.daysOfInterest.forEach(function (day) {
                var dataPerDay = [];
                scope.data[day] = [];

                Object.keys(scope.results.facets).filter(function (object) { return object.indexOf(day) > -1 }).forEach(function (sourceNode) {
                    _.each(scope.results.facets[sourceNode].terms, function (v) {
                        var slice;
                        slice = {
                            axis1: sourceNode.split('~/-#--#-/~')[1],
                            source: sourceNode.split('~/-#--#-/~')[3].toString(),
                            axis2: sourceNode.split('~/-#--#-/~')[2],
                            target: v.term.toString(),
                            data: v.count,
                            color: querySrv.colors[k]
                        };
                        dataPerDay.push(slice);
                        k = k + 1;
                    });
                });
                scope.data[day].push(dataPerDay);
            });
            console.log(scope.data);
        }

        // Function for rendering panel
        function render_panel() {
          var chartData;

          build_results();

          // IE doesn't work without this
          elem.css({height:scope.panel.height||scope.row.height});

          
        }
      }
    };
  });

});
