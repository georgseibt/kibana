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
                * axis1Label:: defines the label for axis1 and which nodes should be displayed on this axis
                */
                axis1Label: '_type',
                /** @scratch /panels/hiveplot/5
                * axis2Label:: defines the label for axis2 and which nodes should be displayed on this axis
                */
                axis2Label: '_type',
                /** @scratch /panels/hiveplot/5
                * axis3Label:: defines the label for axis3 and which nodes should be displayed on this axis
                */
                axis3Label: '_type',
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

                /*
                There are two options how the hiveplot should be created.
                1. One hiveplot for all data in a certain range of time, for example, all data between 1st January and 25th May. Or one hiveplot for all data in the database (no start and end date is given).
                2. Severall hiveplots where each plot only shows the data from a smaller range of time. The data are shown from subcategories. For example, per day, per week, per year, etc.
                */

                /*Implementation for case one*/
                if (false) {
                    var request1 = $scope.ejs.Request().indices(dashboard.indices);
                    request1 = request1
                        .facet(
                            $scope.ejs.TermsFacet($scope.panel.axis1Label)
                            .field($scope.panel.axis1Label)
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
                                $scope.ejs.TermsFacet($scope.panel.axis2Label)
                                .field($scope.panel.axis2Label)
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
                                $scope.ejs.TermsFacet($scope.panel.axis3Label)
                                .field($scope.panel.axis3Label)
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

                        _.each(results1.facets[$scope.panel.axis1Label].terms, function (v) {
                            axis1Labels.push(v.term);
                        });

                        axis1Labels.forEach(function (sourceNode) {
                            request = request
                            .facet(
                                $scope.ejs.TermsFacet($scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                .field($scope.panel.axis2Label)
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
                                                    $scope.panel.axis1Label,
                                                    sourceNode
                                                )
                                            )
                                        ]
                                    )
                                )
                            );
                        });

                        if ($scope.panel.numberOfAxis >= 3) {
                            _.each(results1.facets[$scope.panel.axis2Label].terms, function (v) {
                                axis2Labels.push(v.term);
                            });
                            _.each(results1.facets[$scope.panel.axis3Label].terms, function (v) {
                                axis3Labels.push(v.term);
                            });
                            axis2Labels.forEach(function (sourceNode) {
                                request = request
                                .facet(
                                    $scope.ejs.TermsFacet($scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                    .field($scope.panel.axis3Label)
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
                                                        $scope.panel.axis2Label,
                                                        sourceNode
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
                                    $scope.ejs.TermsFacet($scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                    .field($scope.panel.axis1Label)
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
                                                        $scope.panel.axis3Label,
                                                        sourceNode
                                                    )
                                                )
                                            ]
                                        )
                                    )
                                );
                            });
                        }
                        /*Because we filtered the data before creating the request it can happen that the request remains empty*/

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
                }
                    /*Implementation for case two*/
                else {
                    $scope.daysOfInterest = ['2014-10-01', '2014-10-02', '2014-10-03', '2014-10-04', '2014-10-05'];//, '2014-03-11', '2014-03-12', '2014-03-13', '2014-03-14'];

                    var request1 = $scope.ejs.Request().indices(dashboard.indices);
                    request1 = request1
                        .facet(
                            $scope.ejs.TermsFacet($scope.panel.axis1Label)
                            .field($scope.panel.axis1Label)
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
                                $scope.ejs.TermsFacet($scope.panel.axis2Label)
                                .field($scope.panel.axis2Label)
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
                                $scope.ejs.TermsFacet($scope.panel.axis3Label)
                                .field($scope.panel.axis3Label)
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

                        _.each(results1.facets[$scope.panel.axis1Label].terms, function (v) {
                            axis1Labels.push(v.term);
                        });

                        $scope.daysOfInterest.forEach(function (day) {
                            axis1Labels.forEach(function (sourceNode) {
                                request = request
                                .facet(
                                    $scope.ejs.TermsFacet(day + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                    .field($scope.panel.axis2Label)
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
                                                            $scope.panel.axis1Label,
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
                                _.each(results1.facets[$scope.panel.axis2Label].terms, function (v) {
                                    axis2Labels.push(v.term);
                                });
                                _.each(results1.facets[$scope.panel.axis3Label].terms, function (v) {
                                    axis3Labels.push(v.term);
                                });
                                axis2Labels.forEach(function (sourceNode) {
                                    request = request
                                    .facet(
                                        $scope.ejs.TermsFacet(day + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                        .field($scope.panel.axis3Label)
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
                                                                $scope.panel.axis2Label,
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
                                        $scope.ejs.TermsFacet(day + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                        .field($scope.panel.axis1Label)
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
                                                                $scope.panel.axis3Label,
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
                }
            };

            $scope.build_search = function (axisName, nodeName) {
                //This function filters the result. If you click on a node just the Connections to and from this node are shown
                var queryterm = "";
                if (queryterm === "") {
                    queryterm = queryterm + '' + axisName + ':\"' + nodeName + '\"';
                }
                else {
                    queryterm = queryterm + ' OR ' + axisName + ':\"' + nodeName + '\"';
                }
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
                        //scope.data.forEach(function (d) {
                        //    var obj = _.clone(d);
                        //    chartData.push(obj);
                        //});
                        createHivePlot(scope, scope.data, elem);
                    }

                    /*Build results function for DateHistogramFacet*/
                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the network diagram are now saved in the array 'scope.data'
                        scope.data = [];

                        if (false) {
                            /*
                            Implementation of building the results for case one 
                            (One hiveplot for all data in a certain range of time, for example, all data between 1st January and 25th May. 
                            Or one hiveplot for all data in the database (no start and end date is given).)
                            */
                            if (typeof scope.results.facets !== 'object') {
                                /*
                                Because of some filtering of the data before sending the request, it can happen, that the results.facet is not created. In that case no data should be stored in scope.data
                                */
                            }
                            else {
                                Object.keys(scope.results.facets).forEach(function (sourceNode) {
                                    _.each(scope.results.facets[sourceNode].terms, function (v) {
                                        var slice;
                                        slice = {
                                            axis1: sourceNode.split('~/-#--#-/~')[0],
                                            source: sourceNode.split('~/-#--#-/~')[2].toString(),
                                            axis2: sourceNode.split('~/-#--#-/~')[1],
                                            target: v.term.toString(),
                                            data: v.count,
                                            color: querySrv.colors[k]
                                        };

                                        scope.data.push(slice);
                                        k = k + 1;
                                    });
                                });
                            }
                        }
                        else {
                            /*
                            Implementation of building the results for case two 
                            (Severall hiveplots where each plot only shows the data from a smaller range of time. The data are shown from subcategories. For example, per day, per week, per year, etc.)
                            */
                            if (typeof scope.results.facets !== 'object') {
                                /*
                                Because of some filtering of the data before sending the request, it can happen, that the results.facet is not created. In that case no data should be stored in scope.data
                                */
                            }
                            else {
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
                            }
                        }
                    }
                }
            };

            function createHivePlot(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element
                //d3.select(elem[0]).append('div')
                    //.attr("height", $(elem[0]).height())
                    //.attr("width", $(elem[0]).width())
                    //.attr("class", "hiveplot-panel")
                    //.attr("id", "hiveplotpanel-" + elem[0].id);
                //console.log($(elem[0]).width());
                //console.log($('#hiveplotpanel-' + elem[0].id).width());

                
                
                var axisConfig = [
                    { 'axis': scope.panel.axis1Label, 'sort': scope.panel.axis1Sorting, 'order': scope.panel.axis1Order },      //possible values for sort [label, value, numberOfLinks]
                    { 'axis': scope.panel.axis2Label, 'sort': scope.panel.axis2Sorting, 'order': scope.panel.axis2Order },      //possible values for order [true, false] true means ascending, false means descending
                    { 'axis': scope.panel.axis3Label, 'sort': scope.panel.axis3Sorting, 'order': scope.panel.axis3Order }
                ];

                if (false) {
                    d3.select(elem[0]).append('div')
                        //.attr("height", $(elem[0]).height())
                        //.attr("width", $(elem[0]).width())
                        .attr("class", "hiveplot-panel")
                        .attr("id", "hiveplotpanel-" + elem[0].id);
                    var data = prepareData(dataset);

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
                            scope.build_search(node.axis, node.label);
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

                }
                else {
                    for (var count = 0; count < scope.daysOfInterest.length; count++) {
                        d3.select(elem[0]).append('div')
                        //.attr("height", $(elem[0]).height())
                        //.attr("width", $(elem[0]).width())
                        .attr("class", "hiveplot-panel")
                        .attr("id", "hiveplotpanel-" + count + '' + elem[0].id);
                        var data = prepareData(dataset[scope.daysOfInterest[count]][0]);
                        new Hiveplot.Chart({
                            //Mandatory
                            "elem": "hiveplotpanel-" + count + '' + elem[0].id,     //id of the just created div
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
                                scope.build_search(node.axis, node.label);
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
                    }
                    
                }

                
                                
                function prepareData(dataset) {
                    //var data = [
                    //    { axis1: "from", axis1NodeLabel: "Augsburg", axis2: "to", axis2NodeLabel: "Bremen", value: 5 },
                    //    { axis1: "from", axis1NodeLabel: "Augsburg", axis2: "to", axis2NodeLabel: "Chemnitz", value: 6 },
                    //    { axis1: "from", axis1NodeLabel: "Bremen", axis2: "to", axis2NodeLabel: "Augsburg", value: 2 },
                    //    { axis1: "from", axis1NodeLabel: "Bremen", axis2: "to", axis2NodeLabel: "Hamburg", value: 1 },
                    //    { axis1: "from", axis1NodeLabel: "Chemnitz", axis2: "to", axis2NodeLabel: "Bremen", value: 1 },
                    //    { axis1: "from", axis1NodeLabel: "München", axis2: "to", axis2NodeLabel: "Augsburg", value: 1 },
                    //    { axis1: "to", axis1NodeLabel: "Augsburg", axis2: "Timestamp", axis2NodeLabel: "1395878400000", value: 1 },
                    //    { axis1: "to", axis1NodeLabel: "München", axis2: "Timestamp", axis2NodeLabel: "1395878400000", value: 5 },
                    //    { axis1: "to", axis1NodeLabel: "Hamburg", axis2: "Timestamp", axis2NodeLabel: "1394236800000", value: 1 },
                    //    { axis1: "to", axis1NodeLabel: "Hamburg", axis2: "Timestamp", axis2NodeLabel: "1394409600000", value: 1 },
                    //    { axis1: "from", axis1NodeLabel: "Augsburg", axis2: "Timestamp", axis2NodeLabel: "1394236800000", value: 3 },
                    //    { axis1: "Timestamp", axis1NodeLabel: "1394582400000", axis2: "from", axis2NodeLabel: "Hamburg", value: 3 }
                    //];

                    var data = [];
                    dataset.forEach(function (link) {
                        var object = {
                            axis1: link.axis1,
                            axis1NodeLabel: link.axis1 === 'Timestamp' ? getDateAsString(new Date(parseInt(link.source))) : link.source.toString(),
                            axis2: link.axis2,
                            axis2NodeLabel: link.axis2 === 'Timestamp' ? getDateAsString(new Date(parseInt(link.target))) : link.target.toString(),
                            value: link.data
                        }
                        data.push(object);
                    });
                    return data;
                }
            }

            function getDateAsString(date) {
                var year = date.getFullYear();
                var month = '0' + (date.getMonth() + 1);
                month = month.slice(-2, (month.length - 2) + 3);
                var day = '0' + date.getDate();
                day = day.slice(-2, (day.length - 2) + 3);

                return year + '-' + month + '-' + day;
            }

        });
    }
);
