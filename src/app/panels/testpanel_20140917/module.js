/** @scratch /panels/5
 *
 * include::panels/terms.asciidoc[]
 */

/** @scratch /panels/terms/0
 *
 * == terms
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
    'kbn'],

    function (angular, app, _, $, kbn) {

        'use strict';

        var module = angular.module('kibana.panels.testpanel_20140917', []);
        app.useModule(module);

        module.controller('testpanel_20140917', function ($scope, querySrv, dashboard, filterSrv, fields) {
            //in this function all the magic happens

            $scope.panelMeta = {
                modals: [
                    {
                        description: "Inspect",
                        icon: "icon-info-sign",
                        partial: "app/partials/inspector.html",
                        show: $scope.panel.spyable
                    }
                ],
                editorTabs: [
                    {
                        title: 'Queries', src: 'app/partials/querySelect.html'
                    }
                ],
                status: "Stable",
                description: "Displays the results of an elasticsearch facet as a pie chart, bar chart, or a " +
                    "table"
            };

            // Set and populate defaults
            var _d = {
                /** @scratch /panels/terms/5
                * === Parameters
                *
                * field:: The field on which to computer the facet
                */
                field   : '_type',
                /** @scratch /panels/terms/5
                * exclude:: terms to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/terms/5
                * size:: Show this many terms
                */
                size    : 10,
                /** @scratch /panels/terms/5
                * order:: In terms mode: count, term, reverse_count or reverse_term,
                * in terms_stats mode: term, reverse_term, count, reverse_count,
                * total, reverse_total, min, reverse_min, max, reverse_max, mean or reverse_mean
                */
                order   : 'count',
                /** @scratch /panels/terms/5
                * arrangement:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/terms/5
                * counter_pos:: The location of the legend in respect to the chart, above, below, or none.
                */
                counter_pos : 'above',
                /** @scratch /panels/terms/5
                * spyable:: Set spyable to false to disable the inspect button
                */
                spyable     : true,
                /** @scratch /panels/terms/5
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

            _.defaults($scope.panel, _d);

            $scope.init = function () {
                $scope.hits = 0;    //This is just done when the page is first started
                $scope.$on('refresh', function () {
                    //this part of the code is done if the refresh symbol in the header is clicked
                    $scope.get_data();
                });
                $scope.get_data();  //This is done when the page is started
            };

            $scope.get_data = function () {
                // Make sure we have everything for the request to complete
                if (dashboard.indices.length === 0) {
                    return;
                }
                $scope.panelMeta.loading = true;
                var request,
                    results,
                    boolQuery,
                    queries;

                $scope.field = _.contains(fields.list, $scope.panel.field + '.raw') ?
                    $scope.panel.field + '.raw' : $scope.panel.field;

                request = $scope.ejs.Request().indices(dashboard.indices);

                $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
                queries = querySrv.getQueryObjs($scope.panel.queries.ids);

                // This could probably be changed to a BoolFilter
                boolQuery = $scope.ejs.BoolQuery();
                _.each(queries, function (q) {
                    boolQuery = boolQuery.should(querySrv.toEjsObj(q));
                });
                /*
                Different parts of the request are sticked together: from where the data should be,
                different filters and queries, etc.
                This is saved in the variable 'request'
                */
                request = request
                    .facet(
                        $scope.ejs.TermsFacet('terms')
                        .field($scope.field)
                        .size($scope.panel.size)
                        .order($scope.panel.order)
                        .exclude($scope.panel.exclude)
                        .facetFilter(
                            $scope.ejs.QueryFilter(
                                $scope.ejs.FilteredQuery(
                                    boolQuery,
                                    filterSrv.getBoolFilter(filterSrv.ids())
                                )
                            )
                        )
                    ).size(0);


                // Populate the inspector panel; The current request will be shown in the inspector panel
                $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

                // Populate scope when we have results
                results = request.doSearch().then(function (results) {
                    $scope.panelMeta.loading = false;
                    $scope.hits = results.hits.total;
                    
                    $scope.results = results;


                    $scope.$emit('render'); //dispatches the event upwards through the scope hierarchy of controllers.
                });
            };

            $scope.build_search = function (term, negate) {
                //not sure about this function. I think it is executed if you click on a node in the diagram and it creates a filter. Maybe we don't need this funtion for later
                if (_.isUndefined(term.meta)) {
                    filterSrv.set({
                        type: 'terms', field: $scope.field, value: term.label,
                        mandate: (negate ? 'mustNot' : 'must')
                    });
                }
                else if (term.meta === 'missing') {
                    filterSrv.set({
                        type: 'exists', field: $scope.field,
                        mandate: (negate ? 'must' : 'mustNot')
                    });
                }
                else {
                    return;
                }
            };

            $scope.set_refresh = function (state) {
                //This function is executed if some changes are done in the editor
                //console.log("Warum kann das nur sein");
                $scope.refresh = state;
            };

            $scope.close_edit = function () {
                //This function is executed if the editor is closed
                //The data are loaded again
                if ($scope.refresh) {
                    $scope.get_data();
                }
                $scope.refresh = false;
                $scope.$emit('render');
            };

            //$scope.showMeta = function (term) {
            //    if (_.isUndefined(term.meta)) {
            //        return true;
            //    }
            //    if (term.meta === 'other' && !$scope.panel.other) {
            //        return false;
            //    }
            //    if (term.meta === 'missing' && !$scope.panel.missing) {
            //        return false;
            //    }
            //    return true;
            //};
        });

        module.directive('chordChart', function (querySrv) {
            return {
                restrict: 'A',
                link: function (scope, elem) {
                    var plot;

                    // Receive render events
                    scope.$on('render', function () {
                        render_panel();
                    });

                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the chord diagram are now saved in the array 'scope.data'
                        scope.data = [];
                        //console.log(scope.results.facets.terms.terms);
                        _.each(scope.results.facets.terms.terms, function (v) {
                            var slice;
                            slice = { label: v.term, data: v.count, color: querySrv.colors[k] };
                            
                            scope.data.push(slice);
                            k = k + 1;
                        });
                    }

                    // Function for rendering panel
                    function render_panel() {
                        var chartData;

                        build_results();

                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });

                        // Make a clone we can operate on.
                        chartData = _.clone(scope.data);                                                
                    }
                }
            };           
        });

    }
    );
