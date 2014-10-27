/** @scratch /panels/5
 *
 * include::panels/hiveplot.asciidoc[]
 */

/** @scratch /panels/hiveplot/0
 *
 * == hiveplot
 * Status: *Stable*
 *
 * A hiveplot based on the results of an Elasticsearch term facet.
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

        var module = angular.module('kibana.panels.hiveplot', []);
        app.useModule(module);

        module.controller('hiveplot', function ($scope, querySrv, dashboard, filterSrv, fields) {
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
                description: "Displays the results of an elasticsearch facet as a hiveplot diagram"
            };

            // Set and populate defaults
            var _d = {
                /** @scratch /panels/hiveplot/5
                * === Parameters
                *
                * field:: The field on which to computer the facet
                */
                field   : '_type',
                /** @scratch /panels/hiveplot/5
                * exclude:: terms to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/hiveplot/5
                * size:: Show this many terms
                */
                size: 10,
                /** @scratch /panels/hiveplot/5
                * === Parameters
                *
                * seperator:: The character which divides the column for the connections
                */
                seperator: '-',
                /** @scratch /panels/hiveplot/5
                * order:: How the terms are sorted: count, term, reverse_count or reverse_term,
                */
                order   : 'count',
                /** @scratch /panels/hiveplot/5
                * arrangement:: Arrangement of the legend: horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/hiveplot/5
                * counter_pos:: The location of the legend in respect to the diagram: above, below, or none.
                */
                counter_pos: 'above',
                /** @scratch /panels/hiveplot/5
                * colorcode:: Indicates if the nodes should be coloured or black-white
                */
                colorcode: 'colored',
                /** @scratch /panels/hiveplot/5
                * sortingTooltip:: defines by which criteria the connections in the tooltip should be sorted
                */
                sortingTooltip: 'source',
                /** @scratch /panels/hiveplot/5
                * sortingOrderTooltip:: defines if the nodes should be ordered ascending or descending
                */
                sortingOrderTooltip: true,
                /** @scratch /panels/hiveplot/5
                * tooltipSetting:: Indicates if tooltips should be shown if the user hovers over a segment or chord
                */
                tooltipSetting: true,
                /** @scratch /panels/hiveplot/5
                * numberOfAxis:: defines how many axis should be drawn in the hiveplot
                */
                numberOfAxis: 3,
                /** @scratch /panels/hiveplot/5
                * axis1Label:: defines the label for axis1 and which nodes should be displayed on this axis (possible values are: 'from', 'to', 'time' and 'connection')
                */
                axis1Label: 'from',
                /** @scratch /panels/hiveplot/5
                * axis2Label:: defines the label for axis2 and which nodes should be displayed on this axis (possible values are: 'from', 'to', 'time' and 'connection')
                */
                axis2Label: 'to',
                /** @scratch /panels/hiveplot/5
                * axis3Label:: defines the label for axis3 and which nodes should be displayed on this axis (possible values are: 'from', 'to', 'time' and 'connection')
                */
                axis3Label: 'time',
                /** @scratch /panels/hiveplot/5
                * axis1Sorting:: defines by which criteria the nodes on axis1 are sorted
                */
                axis1Sorting: 'label',
                /** @scratch /panels/hiveplot/5
                * axis2Sorting:: defines by which criteria the nodes on axis2 are sorted
                */
                axis2Sorting: 'label',
                /** @scratch /panels/hiveplot/5
                * axis3Sorting:: defines by which criteria the nodes on axis3 are sorted
                */
                axis3Sorting: 'label',
                /** @scratch /panels/hiveplot/5
                * axis1Order:: defines how the nodes on axis1 are ordered
                */
                axis1Order: true,
                /** @scratch /panels/hiveplot/5
                * axis2Order:: defines how the nodes on axis2 are ordered
                */
                axis2Order: true,
                /** @scratch /panels/hiveplot/5
                * axis3Order:: defines how the nodes on axis3 are ordered
                */
                axis3Order: true,
                /** @scratch /panels/hiveplot/5
                * spyable:: Set spyable to false to disable the inspect button
                */
                spyable     : true,
                /** @scratch /panels/hiveplot/5
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
                $scope.hits = 0;    //This is just executed when the page is first started
                $scope.$on('refresh', function () {
                    //this part of the code is executed if the refresh symbol in the header is clicked
                    $scope.get_data();
                });
                $scope.get_data();  //This is executed when the page is started
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

                $scope.field = _.contains(fields.list, $scope.panel.field + '.raw') ? $scope.panel.field + '.raw' : $scope.panel.field;

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
                
                /*Request for DateHistogramFacet*/
                    //request = request
                    //    .facet(
                    //        $scope.ejs.DateHistogramFacet('terms')
                    //            .field("Timestamp")
                    //            //.valueField("Country_Connection")
                    //            //.keyField("Timestamp")
                    //            .interval("day")
                    //            .order($scope.panel.order)
                    //            .facetFilter(
                    //                $scope.ejs.QueryFilter(
                    //                    $scope.ejs.FilteredQuery(
                    //                        boolQuery,
                    //                        filterSrv.getBoolFilter(filterSrv.ids())
                    //                    )
                    //                )
                    //            )
                    //    )
                    //    .size(0);
               
                request = request
                    .facet(
                        $scope.ejs.TermsFacet('terms')
                            .field($scope.field)
                            .size($scope.panel.size)
                            .order($scope.panel.order)
                            .exclude($scope.panel.exclude)
                            .facetFilter(
                                //$scope.ejs.AndFilter(
                                //    [
                                        $scope.ejs.QueryFilter(
                                            $scope.ejs.FilteredQuery(
                                                boolQuery,
                                                filterSrv.getBoolFilter(filterSrv.ids())
                                            )
                                        //),
                                    //    $scope.ejs.QueryFilter(
                                    //        $scope.ejs.TermQuery(
                                    //            'Timestamp',
                                    //            '2014-03-14'
                                    //        )
                                    //    )
                                    //]
                                )
                            )
                    )
                    .size(0);

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

            $scope.build_search = function (nodeName) {
                //This function filters the result. If you click on a node just the Connections to and from this node are shown
                var queryterm = "";
                $scope.data.forEach(function (d) {
                    if (d.label.indexOf(nodeName) > -1) {
                        if (queryterm === "") {
                            queryterm = queryterm + '' + $scope.field + ':\"' + d.label + '\"';
                        }
                        else {
                            queryterm = queryterm + ' OR ' + $scope.field + ':\"' + d.label + '\"';
                        }
                    }
                })
                filterSrv.set({
                    type: 'querystring', query: queryterm,
                    mandate: 'must'
                });
            };

            $scope.set_refresh = function (state) {
                //This function is executed if some changes are done in the editor
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
        });

        module.directive('hiveplotChart', function (querySrv) {
            return {
                restrict: 'A',
                link: function (scope, elem) {

                    // Receive render events
                    scope.$on('render', function () {
                        render_panel(elem);
                    });

                    // Function for rendering panel
                    function render_panel(elem) {
                        var chartData = [];
                        build_results();
                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });
                        // Make a clone we can operate on and save it in 'chartData'.
                        scope.data.forEach(function (d) {
                            var obj = _.clone(d);
                            chartData.push(obj);
                        });
                        //chartData = _.clone(scope.data););
                        createHivePlot(scope, chartData, elem);
                    }

                    /*Build results function for DateHistogramFacet*/
                        //function build_results() {
                        //    //the result data (the data how we need them to draw the hiveplot diagram are now saved in the array 'scope.data'
                        //    scope.data = [];

                        //    _.each(scope.results.facets.terms.entries, function (v) {
                        //        var slice;
                        //        slice = { label: v.term, data: v.count };                            
                        //        scope.data.push(slice);
                        //    });
                        //}

                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the network diagram are now saved in the array 'scope.data'
                        scope.data = [];
                        _.each(scope.results.facets.terms.terms, function (v) {
                            var slice;
                            slice = { label: v.term, data: v.count, color: querySrv.colors[k] };
                            scope.data.push(slice);
                            k = k + 1;
                        });
                    }
                }
            };

            function createHivePlot(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element
                d3.select(elem[0]).append('div')
                    .attr("class", "hiveplot-panel")
                    .attr("id", "hiveplotpanel-" + elem[0].id);

                var data = prepareData(dataset);
                
                var axisConfig = [
                    { 'axis': scope.panel.axis1Label, 'sort': scope.panel.axis1Sorting, 'order': scope.panel.axis1Order },   //possible values for sort [label, value, numberOfLinks]
                    { 'axis': scope.panel.axis2Label, 'sort': scope.panel.axis2Sorting, 'order': scope.panel.axis2Order },     //possible values for order [true, false] true means ascending, false means descending
                    { 'axis': scope.panel.axis3Label, 'sort': scope.panel.axis3Sorting, 'order': scope.panel.axis3Order }
                ];

                new Hiveplot.Chart({
                    //Mandatory
                    "elem": "hiveplotpanel-" + elem[0].id,     //id of the just created div
                    "data": data,
                    //Optional
                    "colorcode": scope.panel.colorcode,                         //possible values: ['black-white', 'colored']
                    "colors": null,
                    "axisConfig": axisConfig,
                    "sortingTooltip": scope.panel.sortingTooltip,               //possible values: ['source', 'target', 'data']
                    "sortingOrderTooltip": scope.panel.sortingOrderTooltip,     //possible values: [true, false] true means ascending, false means descending
                    "tooltipSetting": scope.panel.tooltipSetting,               //possible values: [true, false]
                    "onClickNode": function (node) {
                        /*
                            Here the user can define a function what happens if the user
                            clicks on a node in the HivePlot.
                            In our case this function should filter the data.
                        */
                        console.log("Function still has to be implemented");
                    },
                    "onClickLink": function (link) {
                        /*
                            Here the user can define a function what happens if the user
                            clicks on a link in the HivePlot.
                            In our case this function should filter the data. 
                        */
                        console.log("Function still has to be implemented");
                    }
                });
                                
                function prepareData(dataset) {
                    //var data = [
                    //    { axis1: "from", axis1NodeLabel: "Augsburg", axis2: "to", axis2NodeLabel: "Bremen", value: 5 },
                    //    { axis1: "from", axis1NodeLabel: "Augsburg", axis2: "to", axis2NodeLabel: "Chemnitz", value: 6 },
                    //    { axis1: "from", axis1NodeLabel: "Bremen", axis2: "to", axis2NodeLabel: "Augsburg", value: 2 },
                    //    { axis1: "from", axis1NodeLabel: "Bremen", axis2: "to", axis2NodeLabel: "Hamburg", value: 1 },
                    //    { axis1: "from", axis1NodeLabel: "Chemnitz", axis2: "to", axis2NodeLabel: "Bremen", value: 1 },
                    //    { axis1: "from", axis1NodeLabel: "München", axis2: "to", axis2NodeLabel: "Augsburg", value: 1 },
                    //    { axis1: "to", axis1NodeLabel: "Augsburg", axis2: "time", axis2NodeLabel: "Monday", value: 1 },
                    //    { axis1: "to", axis1NodeLabel: "München", axis2: "time", axis2NodeLabel: "Monday", value: 5 },
                    //    { axis1: "to", axis1NodeLabel: "Hamburg", axis2: "time", axis2NodeLabel: "Wednesday", value: 1 },
                    //    { axis1: "to", axis1NodeLabel: "Hamburg", axis2: "time", axis2NodeLabel: "Friday", value: 1 },
                    //    { axis1: "from", axis1NodeLabel: "Augsburg", axis2: "time", axis2NodeLabel: "Wednesday", value: 3 }
                    //];

                    //return data;

                    var data = [];

                    dataset.forEach(function (link) {
                        var object = {
                            axis1: 'from',
                            axis1NodeLabel: link.label.split(scope.panel.seperator)[0],
                            axis2: 'to',
                            axis2NodeLabel: link.label.split(scope.panel.seperator)[1],
                            value: link.data
                        }
                        data.push(object);
                    });

                    return data;
                }
            }

        });
    }
);
