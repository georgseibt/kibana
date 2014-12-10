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
                        title: 'Queries',
                        src: 'app/partials/querySelect.html'
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
                * timeField:: The field with the time details
                */
                timeField   : '',
                /** @scratch /panels/hiveplot/5
                * interval:: use this as the interval to calculate aggregations
                */
                interval: '1d',
                /** @scratch /panels/hiveplot/5
                * exclude:: terms to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/hiveplot/5
                * multipanelSetting:: indicates if just one (false) or several (true) panels should be shown
                */
                multipanelSetting: false,
                /** @scratch /panels/hiveplot/5
                * panelInterval:: indicates how the data should be filtered for each panel
                */
                panelInterval: '1d',
                /** @scratch /panels/hiveplot/5
                * comparemodeSetting:: if true, panels show the same nodes on the axes in each panel, except the time axis
                */
                comparemodeSetting: false,
                /** @scratch /panels/hiveplot/5
                * numberOfAxis:: defines how many axis should be drawn in the hiveplot
                */
                numberOfAxis: 2,
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
                * axis1Length:: Show this many terms
                */
                axis1Length: 10,
                /** @scratch /panels/hiveplot/5
                * axis2Length:: Show this many terms
                */
                axis2Length: 10,
                /** @scratch /panels/hiveplot/5
                * axis3Length:: Show this many terms
                */
                axis3Length: 10,
                /** @scratch /panels/hiveplot/5
                * colorcode:: Indicates if the nodes should be coloured or black-white
                */
                colorcode: 'colored',
                /** @scratch /panels/hiveplot/5
                * tooltipSetting:: Indicates if tooltips should be shown if the user hovers over a segment or chord and where the tooltip should be shown
                */
                tooltipSetting: 'movable',
                /** @scratch /panels/hiveplot/5
                * sortingTooltip:: defines by which criteria the connections in the tooltip should be sorted
                */
                sortingTooltip: 'label',
                /** @scratch /panels/hiveplot/5
                * sortingOrderTooltip:: defines if the nodes should be ordered ascending or descending
                */
                sortingOrderTooltip: true,
                /** @scratch /panels/hiveplot/5
                * tooltipOrientation:: Indicates if the text in the tooltip should be horizontal or vertical
                */
                tooltipOrientation: 'horizontal',
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
                $scope.generalTimeField = dashboard.current.nav[0].timefield;      //storing the timefield which is assigned inthe general settings. The timefield is needed if the field should be displayed in the diagram, so the values can be transformed to a date string
                // Make sure we have everything for the request to complete
                if (dashboard.indices.length === 0) {
                    return;
                }
                $scope.panelMeta.loading = true;
                var request,
                    results,
                    boolQuery,
                    queries,
                    aggregateBy,        //variable used to define how the timestamps schould be aggregated
                    request1,
                    results1,
                    aggregatePanelBy,   //variable used to define how the timestamps schould be aggregated between different panels in the case of multipanels
                    aggregatePlotBy,    //variable used to define how the timestamps schould be aggregated within the hiveplot in the case of multipanels
                    requestPanelStartDates,
                    resultsPanelStartDates;

                request = $scope.ejs.Request().indices(dashboard.indices);

                $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
                queries = querySrv.getQueryObjs($scope.panel.queries.ids);

                // This could probably be changed to a BoolFilter
                boolQuery = $scope.ejs.BoolQuery();
                _.each(queries, function (q) {
                    boolQuery = boolQuery.should(querySrv.toEjsObj(q));
                });

                /*
                There are two options how the hiveplot should be created.
                1. One hiveplot for all data in a certain range of time, for example, all data between 1st January and 25th May. Or one hiveplot for all data in the database (no start and end date is given).
                2. Severall hiveplots where each plot only shows the data from a smaller range of time. The data are shown from subcategories. For example, per day, per week, per year, etc.
                */

                /*
                For the Hiveplots we have several cases to consider:
                Case1: One hievplot for all data
                    Case1a: Two axes for the hiveplot
                    Case1b: Three axes for the hiveplot
                Case2: Several hiveplots for the data
                    Case2a: Two axes for the hiveplot
                    Case2b: Three axes for the hiveplot
                */

                /*Implementation for case one*/
                if (!$scope.panel.multipanelSetting) {
                    aggregateBy = $scope.panel.interval;
                    switch (aggregateBy) {
                    case '':
                        aggregateBy = 'second';
                        break;
                    case '15m':
                        aggregateBy = 'hour';
                        break;
                    case '30m':
                        aggregateBy = 'hour';
                        break;
                    case '1h':
                        aggregateBy = 'hour';
                        break;
                    case '12h':
                        aggregateBy = 'day';
                        break;
                    case '1d':
                        aggregateBy = 'day';
                        break;
                    case '1w':
                        aggregateBy = 'week';
                        break;
                    case '1M':
                        aggregateBy = 'month';
                        break;
                    case '1y':
                        aggregateBy = 'year';
                        break;
                    default:
                        aggregateBy = 'second';
                        break;
                    }

                    var intervals = [];
                    request1 = $scope.ejs.Request().indices(dashboard.indices);
                    /*Case 1a: just two axes*/
                    request1 = request1
                        .facet(
                            $scope.ejs.TermsFacet($scope.panel.axis1Label)
                                .field($scope.panel.axis1Label)
                                .size($scope.panel.axis1Length)
                                .order('count')
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
                            $scope.ejs.TermsFacet($scope.panel.axis2Label)
                                .field($scope.panel.axis2Label)
                                .size($scope.panel.axis2Length)
                                .order('count')
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
                        .size(0);
                    if ($scope.panel.timeField !== "") {
                        request1 = request1
                            .facet(
                                $scope.ejs.DateHistogramFacet('dates')
                                    .field($scope.panel.timeField)
                                    .interval(aggregateBy)
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
                            .size(0);
                    }

                    if ($scope.panel.numberOfAxis >= 3) {
                        request1 = request1
                            .facet(
                                $scope.ejs.TermsFacet($scope.panel.axis3Label)
                                    .field($scope.panel.axis3Label)
                                    .size($scope.panel.axis3Length)
                                    .order('count')
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
                            .size(0);
                    }

                    results1 = request1.doSearch().then(function (results1) {
                        /*Defining the start and end date. These dates are required to calculate the correct intervals*/
                        var dates = [],
                            axis1Labels = [],
                            axis2Labels = [],
                            axis3Labels = [];
                        try {
                            _.each(results1.facets.dates.entries, function (v) {
                                dates.push(v.time);
                            });

                            intervals = $scope.getIntervals2(dates, $scope.panel.interval);
                        } catch (error) { }

                        _.each(results1.facets[$scope.panel.axis1Label].terms, function (v) {
                            axis1Labels.push(v.term);
                        });
                        _.each(results1.facets[$scope.panel.axis2Label].terms, function (v) {
                            axis2Labels.push(v.term);
                        });

                        if ($scope.panel.axis1Label === $scope.panel.timeField) {
                            /*If the time should be displayed on axis 1*/
                            intervals.forEach(function (date) {
                                request = request
                                    .facet(
                                        $scope.ejs.TermsFacet($scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + date.startDate)
                                            .field($scope.panel.axis2Label)
                                            .size($scope.panel.axis2Length)
                                            .order('count')
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
                                                        $scope.ejs.RangeFilter($scope.panel.timeField)
                                                            .from(new Date(parseInt(date.startDate, 10)))
                                                            .to(new Date(parseInt(date.endDate, 10)))
                                                    ]
                                                )
                                            )
                                    )
                                    .size(0);
                            });
                        }
                        else if ($scope.panel.axis2Label === $scope.panel.timeField) {
                            /*If the time should be displayed on axis 2*/
                            intervals.forEach(function (date) {
                                request = request
                                    .facet(
                                        $scope.ejs.TermsFacet($scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + date.startDate)
                                            .field($scope.panel.axis1Label)
                                            .size($scope.panel.axis1Length)
                                            .order('count')
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
                                                        $scope.ejs.RangeFilter($scope.panel.timeField)
                                                            .from(new Date(parseInt(date.startDate, 10)))
                                                            .to(new Date(parseInt(date.endDate, 10)))
                                                    ]
                                                )
                                            )
                                    )
                                    .size(0);
                            });
                        }
                        else {
                            /*If no axis displays the time*/
                            axis1Labels.forEach(function (sourceNode) {
                                request = request
                                    .facet(
                                        $scope.ejs.TermsFacet($scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                            .field($scope.panel.axis2Label)
                                            .size($scope.panel.axis2Length)
                                            .order('count')
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
                                    )
                                    .size(0);
                            });
                            axis2Labels.forEach(function (sourceNode) {
                                request = request
                                    .facet(
                                        $scope.ejs.TermsFacet($scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                            .field($scope.panel.axis1Label)
                                            .size($scope.panel.axis1Length)
                                            .order('count')
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
                                    )
                                    .size(0);
                            });
                        }

                        if ($scope.panel.numberOfAxis >= 3) {
                            /*if the numberOfAxis is 3. We also have to define the links between axis1-axis3 and axis2-axis3*/
                            _.each(results1.facets[$scope.panel.axis3Label].terms, function (v) {
                                axis3Labels.push(v.term);
                            });

                            if ($scope.panel.axis1Label === $scope.panel.timeField) {
                                /*Create links between axis1-axis3 (axis1 is the time-axis)*/
                                intervals.forEach(function (date) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + date.startDate)
                                                .field($scope.panel.axis3Label)
                                                .size($scope.panel.axis3Length)
                                                .order('count')
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
                                                            $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                .from(new Date(parseInt(date.startDate, 10)))
                                                                .to(new Date(parseInt(date.endDate, 10)))
                                                        ]
                                                    )
                                                )
                                        )
                                        .size(0);
                                });
                                /*Create links between axis2-axis3*/
                                axis2Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis3Label)
                                                .size($scope.panel.axis3Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                                axis3Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis2Label)
                                                .size($scope.panel.axis2Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                            }
                            else if ($scope.panel.axis2Label === $scope.panel.timeField) {
                                /*Create links between axis2-axis3 (axis2 is the time-axis)*/
                                intervals.forEach(function (date) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + date.startDate)
                                                .field($scope.panel.axis3Label)
                                                .size($scope.panel.axis3Length)
                                                .order('count')
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
                                                            $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                .from(new Date(parseInt(date.startDate, 10)))
                                                                .to(new Date(parseInt(date.endDate, 10)))
                                                        ]
                                                    )
                                                )
                                        )
                                        .size(0);
                                });
                                /*Create links between axis1-axis3*/
                                axis1Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis3Label)
                                                .size($scope.panel.axis3Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                                axis3Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis1Label)
                                                .size($scope.panel.axis1Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                            }
                            else if ($scope.panel.axis3Label === $scope.panel.timeField) {
                                /*Create links between axis3-axis1 (axis3 is the time-axis)*/
                                intervals.forEach(function (date) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + date.startDate)
                                                .field($scope.panel.axis1Label)
                                                .size($scope.panel.axis1Length)
                                                .order('count')
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
                                                            $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                .from(new Date(parseInt(date.startDate, 10)))
                                                                .to(new Date(parseInt(date.endDate, 10)))
                                                        ]
                                                    )
                                                )
                                        )
                                        .size(0);
                                });
                                /*Create links between axis3-axis2 (axis3 is the time-axis)*/
                                intervals.forEach(function (date) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + date.startDate)
                                                .field($scope.panel.axis2Label)
                                                .size($scope.panel.axis2Length)
                                                .order('count')
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
                                                            $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                .from(new Date(parseInt(date.startDate, 10)))
                                                                .to(new Date(parseInt(date.endDate, 10)))
                                                        ]
                                                    )
                                                )
                                        )
                                        .size(0);
                                });
                            }
                            else {
                                /*If no axis displays the time*/
                                axis2Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis3Label)
                                                .size($scope.panel.axis3Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                                axis3Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis2Label)
                                                .size($scope.panel.axis2Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                                axis3Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis1Label)
                                                .size($scope.panel.axis1Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                                axis1Labels.forEach(function (sourceNode) {
                                    request = request
                                        .facet(
                                            $scope.ejs.TermsFacet($scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                .field($scope.panel.axis3Label)
                                                .size($scope.panel.axis3Length)
                                                .order('count')
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
                                        )
                                        .size(0);
                                });
                            }
                        }

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
                else if ($scope.panel.multipanelSetting) {
                    /*Defining how the data between each hiveplot should be aggregated*/
                    aggregatePanelBy = $scope.panel.panelInterval;
                    switch (aggregatePanelBy) {
                    case '1d':
                        aggregatePanelBy = 'day';
                        break;
                    case '1w':
                        aggregatePanelBy = 'week';
                        break;
                    case '1M':
                        aggregatePanelBy = 'month';
                        break;
                    case '1y':
                        aggregatePanelBy = 'year';
                        break;
                    default:
                        aggregatePanelBy = 'second';
                        break;
                    }
                    /*Defining how the data within each hiveplot should be aggregated*/
                    aggregatePlotBy = $scope.panel.interval;
                    switch (aggregatePlotBy) {
                    case '':
                        aggregatePlotBy = 'second';
                        break;
                    case '15m':
                        aggregatePlotBy = 'hour';
                        break;
                    case '30m':
                        aggregatePlotBy = 'hour';
                        break;
                    case '1h':
                        aggregatePlotBy = 'hour';
                        break;
                    case '12h':
                        aggregatePlotBy = 'day';
                        break;
                    case '1d':
                        aggregatePlotBy = 'day';
                        break;
                    case '1w':
                        aggregatePlotBy = 'week';
                        break;
                    case '1M':
                        aggregatePlotBy = 'month';
                        break;
                    case '1y':
                        aggregatePlotBy = 'year';
                        break;
                    default:
                        aggregatePlotBy = 'second';
                        break;
                    }

                    requestPanelStartDates = $scope.ejs.Request().indices(dashboard.indices);
                    if ($scope.panel.timeField !== "") {
                        requestPanelStartDates = requestPanelStartDates
                            .facet(
                                $scope.ejs.DateHistogramFacet('panelStartDates')
                                    .field($scope.panel.timeField)
                                    .interval(aggregatePanelBy)
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
                            .size(0);
                    }
                    else {
                        alert("Please enter a valid value for the time field in the configurations.");
                    }

                    $scope.panelStartDates = [];
                    $scope.panelIntervals = [];
                    resultsPanelStartDates = requestPanelStartDates.doSearch().then(function (resultsPanelStartDates) {
                        /*Defining the start and end date. These dates are required to calculate the correct intervals*/

                        $scope.resultsPanelStartDates = resultsPanelStartDates;
                        try {
                            _.each(resultsPanelStartDates.facets.panelStartDates.entries, function (v) {
                                $scope.panelStartDates.push(v.time);

                            });
                        } catch (ignore) { }
                        $scope.panelIntervals = $scope.getIntervals2($scope.panelStartDates, $scope.panel.panelInterval);
                        $scope.panelIntervals.forEach(function (panelPointOfTime) {

                            /*The hiveplot should not display all nodes on every axis but limit it to the top N.
                            For that reason the data is filtered and for each axis the top N in the timeframe of the hiveplot is defined.
                            Also the intervals of the nodes on the timeaxis are defined.
                            The results are saved in request1*/
                            request1 = $scope.ejs.Request().indices(dashboard.indices);
                            request1 = request1
                                .facet(
                                    $scope.ejs.TermsFacet($scope.panel.axis1Label)
                                        .field($scope.panel.axis1Label)
                                        .size($scope.panel.axis1Length)
                                        .order('count')
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
                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                ]
                                            )
                                        )
                                )
                                .facet(
                                    $scope.ejs.TermsFacet($scope.panel.axis2Label)
                                        .field($scope.panel.axis2Label)
                                        .size($scope.panel.axis2Length)
                                        .order('count')
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
                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                ]
                                            )
                                        )
                                )
                                /*create request for the intervals to create the plots*/
                                .facet(
                                    $scope.ejs.DateHistogramFacet('plotIntervals')
                                        .field($scope.panel.timeField)
                                        .interval(aggregatePlotBy)
                                        .facetFilter(
                                            $scope.ejs.AndFilter(
                                                [
                                                    $scope.ejs.QueryFilter(
                                                        $scope.ejs.FilteredQuery(
                                                            boolQuery,
                                                            filterSrv.getBoolFilter(filterSrv.ids())
                                                        )
                                                    ),
                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                ]
                                            )
                                        )
                                )
                                .size(0);

                            if ($scope.panel.numberOfAxis >= 3) {
                                request1 = request1
                                    .facet(
                                        $scope.ejs.TermsFacet($scope.panel.axis3Label)
                                            .field($scope.panel.axis3Label)
                                            .size($scope.panel.axis3Length)
                                            .order('count')
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
                                                        $scope.ejs.RangeFilter($scope.panel.timeField)
                                                            .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                            .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                    ]
                                                )
                                            )
                                    )
                                    .size(0);
                            }

                            var axis1Labels = [],
                                axis2Labels = [],
                                axis3Labels = [],
                                timeAxisNodes = [],
                                timeAxisNodesIntervals = [];

                            results1 = request1.doSearch().then(function (results1) {
                                /*Saving the top N nodes in arrays*/
                                _.each(results1.facets[$scope.panel.axis1Label].terms, function (v) {
                                    axis1Labels.push(v.term);
                                });
                                _.each(results1.facets[$scope.panel.axis2Label].terms, function (v) {
                                    axis2Labels.push(v.term);
                                });
                                if ($scope.panel.numberOfAxis >= 3) {
                                    _.each(results1.facets[$scope.panel.axis3Label].terms, function (v) {
                                        axis3Labels.push(v.term);
                                    });
                                }
                                _.each(results1.facets.plotIntervals.entries, function (v) {
                                    timeAxisNodes.push(v.time);
                                });
                                timeAxisNodesIntervals = $scope.getIntervals2(timeAxisNodes, $scope.panel.interval);

                                /*If the time is displayed on axis 1, the links schould be created between Axis1->Axis2. The number of nodes on the time
                                axis is not limited to a concrete number. But it is limited by the defined interval.
                                */
                                if ($scope.panel.axis1Label === $scope.panel.timeField) {
                                    /*Create links between axis1->axis2 (axis1 is the time-axis)*/
                                    timeAxisNodesIntervals.forEach(function (date) {
                                        request = request
                                            .facet(
                                                $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + date.startDate)
                                                    .field($scope.panel.axis2Label)
                                                    .size($scope.panel.axis2Length)
                                                    .order('count')
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
                                                                $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                    .from(new Date(parseInt(date.startDate, 10)))
                                                                    .to(new Date(parseInt(date.endDate, 10))),
                                                                $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                    .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                    .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                            ]
                                                        )
                                                    )
                                            )
                                            .size(0);
                                    });
                                }
                                /*If the time is displayed on axis 2, the links schould be created between Axis2->Axis1. The number of nodes on the time
                                axis is not limited to a concrete number. But it is limited by the defined interval.
                                */
                                else if ($scope.panel.axis2Label === $scope.panel.timeField) {
                                    /*Create links between axis2->axis1 (axis2 is the time-axis)*/
                                    timeAxisNodesIntervals.forEach(function (date) {
                                        request = request
                                            .facet(
                                                $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + date.startDate)
                                                    .field($scope.panel.axis1Label)
                                                    .size($scope.panel.axis1Length)
                                                    .order('count')
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
                                                                $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                    .from(new Date(parseInt(date.startDate, 10)))
                                                                    .to(new Date(parseInt(date.endDate, 10))),
                                                                $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                    .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                    .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                            ]
                                                        )
                                                    )
                                            )
                                            .size(0);
                                    });
                                }
                                /*If the time is displayed not displayed on any axis, the links schould be created between Axis1->Axis2 AND Axis2->Axis1. The number of nodes on 
                                each axis is limited to a concrete number. However, at the end the number on each axis can be more because of the directed calculations.
                                */
                                else {
                                    /*Create links between axis1->axis2*/
                                    axis1Labels.forEach(function (sourceNode) {
                                        /*Calculating links from Axis1->Axis2*/
                                        request = request
                                            .facet(
                                                $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                                    .field($scope.panel.axis2Label)
                                                    .size($scope.panel.axis2Length)
                                                    .order('count')
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
                                                                $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                    .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                    .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                            ]
                                                        )
                                                    )
                                            )
                                            .size(0);
                                    });
                                    /*Create links between axis2->axis1*/
                                    axis2Labels.forEach(function (sourceNode) {
                                        /*Calculating links from Axis2->Axis1*/
                                        request = request
                                            .facet(
                                                $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                                    .field($scope.panel.axis1Label)
                                                    .size($scope.panel.axis1Length)
                                                    .order('count')
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
                                                                $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                    .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                    .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                            ]
                                                        )
                                                    )
                                            )
                                            .size(0);
                                    });
                                }

                                /*The following code will just be executed, if the hiveplot shows three axis.
                                In this case some more links have to be calculated
                                */
                                if ($scope.panel.numberOfAxis >= 3) {
                                    /*If the time is displayed on axis 1, additional links schould be created between Axis1->Axis3, Axis3->Axis2, and Axis2->Axis3. 
                                    The number of nodes on Axis2 and Axis3 is limited. However, at the end the number on each axis can be more because of the directed calculations.
                                    */
                                    if ($scope.panel.axis1Label === $scope.panel.timeField) {
                                        /*Create links between axis1->axis3 (axis1 is the time-axis)*/
                                        timeAxisNodesIntervals.forEach(function (date) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + date.startDate)
                                                        .field($scope.panel.axis3Label)
                                                        .size($scope.panel.axis3Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(date.startDate, 10)))
                                                                        .to(new Date(parseInt(date.endDate, 10))),
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis2->axis3*/
                                        axis2Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis3Label)
                                                        .size($scope.panel.axis3Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis3->axis2*/
                                        axis3Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis2Label)
                                                        .size($scope.panel.axis2Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });                                        
                                    }
                                    /*If the time is displayed on axis 2, additional links schould be created between Axis2->Axis3, Axis1->Axis3, and Axis3->Axis1. 
                                    The number of nodes on Axis1 and Axis3 is limited. However, at the end the number on each axis can be more because of the directed calculations.
                                    */
                                    else if ($scope.panel.axis2Label === $scope.panel.timeField) {
                                        /*Create links between axis2->axis3 (axis2 is the time-axis)*/                                        
                                        timeAxisNodesIntervals.forEach(function (date) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + date.startDate)
                                                        .field($scope.panel.axis3Label)
                                                        .size($scope.panel.axis3Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(date.startDate, 10)))
                                                                        .to(new Date(parseInt(date.endDate, 10))),
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis1->axis3*/
                                        axis1Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis3Label)
                                                        .size($scope.panel.axis3Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis3->axis1*/
                                        axis3Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis1Label)
                                                        .size($scope.panel.axis1Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                    }
                                    /*If the time is displayed on axis 3, additional links schould be created between Axis3->Axis1, Axis1->Axis3, and Axis3->Axis1. 
                                    The number of nodes on Axis1 and Axis3 is limited. However, at the end the number on each axis can be more because of the directed calculations.
                                    */
                                    else if ($scope.panel.axis3Label === $scope.panel.timeField) {
                                        /*Create links between axis3->axis1 (axis3 is the time-axis)*/
                                        timeAxisNodesIntervals.forEach(function (date) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + date.startDate)
                                                        .field($scope.panel.axis1Label)
                                                        .size($scope.panel.axis1Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(date.startDate, 10)))
                                                                        .to(new Date(parseInt(date.endDate, 10))),
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis3->axis2 (axis3 is the time-axis)*/
                                        timeAxisNodesIntervals.forEach(function (date) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + date.startDate)
                                                        .field($scope.panel.axis2Label)
                                                        .size($scope.panel.axis2Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(date.startDate, 10)))
                                                                        .to(new Date(parseInt(date.endDate, 10))),
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                    }
                                    else {
                                        /*Create links between axis2->axis3*/
                                        axis2Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis3Label)
                                                        .size($scope.panel.axis3Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis3->axis2*/
                                        axis3Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis2Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis2Label)
                                                        .size($scope.panel.axis2Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis3->axis1*/
                                        axis3Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis1Label)
                                                        .size($scope.panel.axis1Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                        /*Create links between axis1->axis3*/
                                        axis1Labels.forEach(function (sourceNode) {
                                            request = request
                                                .facet(
                                                    $scope.ejs.TermsFacet(panelPointOfTime.startDate + '~/-#--#-/~' + $scope.panel.axis1Label + '~/-#--#-/~' + $scope.panel.axis3Label + '~/-#--#-/~' + sourceNode)
                                                        .field($scope.panel.axis3Label)
                                                        .size($scope.panel.axis3Length)
                                                        .order('count')
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
                                                                    $scope.ejs.RangeFilter($scope.panel.timeField)
                                                                        .from(new Date(parseInt(panelPointOfTime.startDate, 10)))
                                                                        .to(new Date(parseInt(panelPointOfTime.endDate, 10)))
                                                                ]
                                                            )
                                                        )
                                                )
                                                .size(0);
                                        });
                                    }

                                }

                                results = request.doSearch().then(function (results) {
                                    $scope.panelMeta.loading = false;
                                    $scope.hits = results.hits.total;
                                    $scope.results = results;
                                    $scope.$emit('render'); //dispatches the event upwards through the scope hierarchy of controllers.
                                });
                            });

                        });
                    });
                }
            };

            $scope.getIntervals2 = function (listOfDates, interval) {
                /*
                    Format of the passed variable:
                        listOfDates: is an array with different dates. Each date represents the beginning of a  new period
                        interval: is value of the following possibilities : 15m, 30m, 1h, 12h, 1d, 1w, 1M, 1y

                    Task of the function:
                        This function calculates periods of time. For each value in listOfDates a period of time is calculated. The interval indicates how long the period should be

                    Format of the return value:
                        The function returns an array of several periods of time. Each period is an object with a startDate and an endDate
                */
                var intervalNumber = interval.slice(0, interval.length - 1),
                    aggregateBy = interval.slice(interval.length - 1, interval.length),
                    ranges = [],
                    k,
                    _start,
                    _end,
                    object;

                switch (aggregateBy) {
                case 'y':
                    aggregateBy = 'year';
                    break;
                case 'q':
                    aggregateBy = 'quarter';
                    break;
                case 'M':
                    aggregateBy = 'month';
                    break;
                case 'w':
                    aggregateBy = 'week';
                    break;
                case 'd':
                    aggregateBy = 'day';
                    break;
                case 'h':
                    aggregateBy = 'hour';
                    break;
                case 'm':
                    aggregateBy = 'minute';
                    break;
                case 's':
                    aggregateBy = 'second';
                    break;
                default:
                    aggregateBy = 'second';
                    break;
                }

                k = interval === '' ? 1 : parseInt(intervalNumber, 10);   //if the interval is empty we aggregate the data by each second.

                if (k === 1) {
                    /*Easy case, as the intervals are complete hours, days, weeks or similar*/
                    listOfDates.forEach(function (date) {
                        _start = date;
                        _end = $scope.dateAdd($scope.dateAdd(date, aggregateBy, k), 'second', -0.001);  //the endDate is always the startDate + the interval - 1millisecond. The millisecond is subtracted so there is no overlap between the periods of time

                        object = {
                            startDate: _start,
                            endDate: (new Date(_end)).getTime()
                        };
                        ranges.push(object);
                    });
                }
                    /*
                        If the interval is not a complete hour, day etc, multiple periods have to be calculated
                    */
                else if (interval === '15m') {
                    //In this case 4 intervals have to be calculated within the same hour
                    listOfDates.forEach(function (date) {
                        var count;
                        for (count = 1; count <= 4; count++) {
                            _start = $scope.dateAdd(date, aggregateBy, (count - 1) * k);
                            _end = $scope.dateAdd($scope.dateAdd(date, aggregateBy, count * k), 'second', -0.001);

                            object = {
                                startDate: (new Date(_start)).getTime(),
                                endDate: (new Date(_end)).getTime()
                            };
                            ranges.push(object);
                        }
                    });
                }
                else if (interval === '30m') {
                    //In this case 2 intervals have to be calculated within the same hour
                    listOfDates.forEach(function (date) {
                        var count;
                        for (count = 1; count <= 2; count++) {
                            _start = $scope.dateAdd(date, aggregateBy, (count - 1) * k);
                            _end = $scope.dateAdd($scope.dateAdd(date, aggregateBy, count * k), 'second', -0.001);

                            object = {
                                startDate: (new Date(_start)).getTime(),
                                endDate: (new Date(_end)).getTime()
                            };
                            ranges.push(object);
                        }
                    });
                }
                else if (interval === '12h') {
                    //In this case 2 intervals have to be calculated within the same day
                    listOfDates.forEach(function (date) {
                        var count;
                        for (count = 1; count <= 2; count++) {
                            _start = $scope.dateAdd(date, aggregateBy, (count - 1) * k);
                            _end = $scope.dateAdd($scope.dateAdd(date, aggregateBy, count * k), 'second', -0.001);

                            object = {
                                startDate: (new Date(_start)).getTime(),
                                endDate: (new Date(_end)).getTime()
                            };

                            ranges.push(object);
                        }
                    });
                }
                else if (interval === '') {
                    listOfDates.forEach(function (date) {
                        _start = date;
                        _end = $scope.dateAdd($scope.dateAdd(date, aggregateBy, k), 'second', -0.001);

                        object = {
                            startDate: _start,
                            endDate: (new Date(_end)).getTime()
                        };
                        ranges.push(object);
                    });
                }

                return ranges;
            };
            $scope.build_search = function (axisName, nodeName) {
                //This function filters the result. If you click on a node just the Connections to and from this node are shown
                var queryterm = "",
                    date = [];
                if (axisName === $scope.panel.timeField) {
                    date.push(nodeName);
                    date = ($scope.getIntervals2(date, $scope.panel.interval)[0]);
                    filterSrv.set({
                        type: 'time',
                        from: new Date(date.startDate),
                        to: new Date(date.endDate),
                        field: axisName
                    });
                }
                else if (axisName === $scope.generalTimeField) {
                    date.push(nodeName);
                    filterSrv.set({
                        type: 'time',
                        from: new Date(date[0]),
                        to: new Date(date[0]),
                        field: axisName
                    });
                }
                else {
                    if (queryterm === "") {
                        queryterm = queryterm + '' + axisName + ':\"' + nodeName + '\"';
                    }
                    else {
                        queryterm = queryterm + ' OR ' + axisName + ':\"' + nodeName + '\"';
                    }
                    filterSrv.set({
                        type: 'querystring',
                        query: queryterm,
                        mandate: 'must'
                    });
                }
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
            $scope.dateAdd = function (date, interval, units) {
                /*
                    Format of the passed variable:
                        date: is a date in milliseconds
                        interval: is value of the following possibilities : second, minute, hour, day, week, month, quarter, year
                        units: any number

                    Task of the function:
                        This function adds a specific amount of time, for example 15 minutes, 0.01 seconds etc., to a date

                    Format of the return value:
                        The function returns a time in miliseconds
                */
                var ret = new Date(date); //don't change original date
                switch (interval.toLowerCase()) {
                case 'year':
                    ret.setFullYear(ret.getFullYear() + units);
                    break;
                case 'quarter':
                    ret.setMonth(ret.getMonth() + 3 * units);
                    break;
                case 'month':
                    ret.setMonth(ret.getMonth() + units);
                    break;
                case 'week':
                    ret.setDate(ret.getDate() + 7 * units);
                    break;
                case 'day':
                    ret.setDate(ret.getDate() + units);
                    break;
                case 'hour':
                    ret.setTime(ret.getTime() + units * 3600000);
                    break;
                case 'minute':
                    ret.setTime(ret.getTime() + units * 60000);
                    break;
                case 'second':
                    ret.setTime(ret.getTime() + units * 1000);
                    break;
                default:
                    ret = undefined;
                    break;
                }
                return ret;
            };
            $scope.getDateAsString = function (date) {
                /*
                    Format of the passed variable:
                        date: is a date in date format

                    Task of the function:
                        This function transforms a date to the format YYYY-MM-dd hh:mm:ss

                    Format of the return value:
                        The function returns a time as a string in the format YYYY-MM-dd hh:mm:ss
                */
                var year, month, day, hour, minute, second;

                year = date.getFullYear();
                month = '0' + (date.getMonth() + 1);
                month = month.slice(-2, (month.length - 2) + 3);
                day = '0' + date.getDate();
                day = day.slice(-2, (day.length - 2) + 3);
                hour = '0' + date.getHours();
                hour = hour.slice(-2, (hour.length - 2) + 3);
                minute = '0' + date.getMinutes();
                minute = minute.slice(-2, (minute.length - 2) + 3);
                second = '0' + date.getSeconds();
                second = second.slice(-2, (second.length - 2) + 3);

                return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
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
                        build_results();
                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });

                        createHivePlot(scope, scope.data, elem);
                    }

                    /*Build results function for DateHistogramFacet*/
                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the network diagram are now saved in the array 'scope.data'
                        scope.data = [];

                        if (!scope.panel.multipanelSetting) {
                            /*
                            Implementation of building the results for case one 
                            (One hiveplot for all data in a certain range of time, for example, all data between 1st January and 25th May. 
                            Or one hiveplot for all data in the database (no start and end date is given).)
                            */

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
                        else if (scope.panel.multipanelSetting) {
                            /*
                            Implementation of building the results for case two 
                            (Severall hiveplots where each plot only shows the data from a smaller range of time. The data are shown from subcategories. For example, per day, per week, per year, etc.)
                            */
                            scope.panelIntervals.forEach(function (range) {
                                var dataPerDay = [];
                                scope.data[range.startDate] = [];

                                Object.keys(scope.results.facets).filter(function (object) { return object.indexOf(range.startDate) > -1; }).forEach(function (sourceNode) {
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
                                scope.data[range.startDate].push(dataPerDay);
                            });
                        }
                    }
                }
            };

            function createHivePlot(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element  

                var axisConfig = [
                    { 'axis': scope.panel.axis1Label, 'sort': scope.panel.axis1Sorting, 'order': scope.panel.axis1Order },      //possible values for sort [label, value, numberOfLinks]
                    { 'axis': scope.panel.axis2Label, 'sort': scope.panel.axis2Sorting, 'order': scope.panel.axis2Order }],
                    data,
                    linkValues = [];
                if (scope.panel.numberOfAxis >= 3) {
                    axisConfig.push({ 'axis': scope.panel.axis3Label, 'sort': scope.panel.axis3Sorting, 'order': scope.panel.axis3Order });
                }

                /*Creating one div where the panel will be drawn*/
                d3.select(elem[0]).append('div')
                    .style("float", function (d) { return scope.panel.tooltipSetting === "static" ? "left" : "right"; })
                    .style("width", function (d) { return scope.panel.tooltipSetting === "static" ? "80%" : "100%"; })
                    .style("height", function () { return 100 + "%"; })
                    .attr("class", "hiveplot-innerpanels")
                    .attr("id", "hiveplotpanel-" + elem[0].id);

                d3.select(elem[0]).append('div')
                    .style("float", "left")
                    .style("width", function (d) { return scope.panel.tooltipSetting === "static" ? "20%" : "0%"; })
                    .style("height", function () { return 100 + "%"; })
                    .attr("id", "tooltip-" + elem[0].id);

                if (!scope.panel.multipanelSetting) {

                    data = prepareData(dataset);

                    new Hiveplot.Chart({
                        //Mandatory
                        "plotElem": "hiveplotpanel-" + elem[0].id,     //id of the just created div
                        "data": data,
                        //Optional
                        "tooltipElem": "tooltip-" + elem[0].id,
                        "colorcode": scope.panel.colorcode,                         //possible values: ['black-white', 'colored']
                        "nodesColorSchema": "blue",
                        "linksColorSchema": ['#FFD700', '#FF0000', 10],
                        "axisConfig": axisConfig,
                        "nodes": null,
                        "linkMin": null,
                        "linkMax": null,
                        "tooltipSetting": scope.panel.tooltipSetting,               //possible values: ['none', 'movable', 'static']
                        "sortingTooltip": scope.panel.sortingTooltip,               //possible values: ['source', 'target', 'data']
                        "sortingOrderTooltip": scope.panel.sortingOrderTooltip,     //possible values: [true, false] true means ascending, false means descending
                        "tooltipOrientation": scope.panel.tooltipOrientation,       //possible values: ['horizontal', 'vertical']
                        "onClickNode": function (node) {
                            /*
                                Here the user can define a function what happens if the user
                                clicks on a node in the HivePlot.
                                In our case this function should filter the data.
                            */
                            scope.build_search(node.axis, (node.axis === scope.panel.timeField || node.axis === scope.generalTimeField ) ? new Date(node.label.replace(" ", "T")).getTime() : node.label);
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
                else if (scope.panel.multipanelSetting) {
                    var item;
                    for (item in scope.data) {
                        /*To determine the maximum and minimum of all relations. The values of the relations (datapoint.data) are stored in the array linkValues. This array is used later to determine the 
                        maximum and minimum*/
                        scope.data[item][0].forEach(function (datapoint) {
                            linkValues.push(datapoint.data);
                        });
                    }
                    var number = scope.panelIntervals.length; //number of plots
                    var width = $("#hiveplotpanel-" + elem[0].id).width();
                    var height = $("#hiveplotpanel-" + elem[0].id).height();
                    var elementArea = parseInt((height * width / number), 10);

                    // Calculate side length if there is no "spill":
                    var sideLength = parseInt(Math.sqrt(elementArea), 10);
                    // We now need to fit the squares. Let's reduce the square size so an integer number fits the width.
                    var numX = Math.ceil(width / sideLength);
                    sideLength = width / numX;
                    while (numX <= number) {
                        // With a bit of luck, we are done.
                        if (Math.floor(height / sideLength) * numX >= number) {
                            // They all fit! We are done!
                            break;
                        }
                        // They don't fit. Make room for one more square in each row.
                        numX++;
                        sideLength = width / numX;
                    }

                    var nodes = [];
                    if (scope.panel.comparemodeSetting) {
                        var listOfNodes = [],
                            k = 0;

                        var element;
                        for (element in dataset) {
                            dataset[element][0].forEach(function (d) {
                                var object = {
                                    axis: d.axis1,
                                    label: (d.axis1 === scope.panel.timeField || d.axis1 === scope.generalTimeField) ? scope.getDateAsString(new Date(parseInt(d.source, 10))) : d.source.toString() //d.source
                                };
                                listOfNodes[d.axis1 + '-' + d.source] = object;
                                object = {
                                    axis: d.axis2,
                                    label: (d.axis2 === scope.panel.timeField || d.axis2 === scope.generalTimeField) ? scope.getDateAsString(new Date(parseInt(d.target, 10))) : d.target.toString() //d.target
                                };
                                listOfNodes[d.axis2 + '-' + d.target] = object;
                            });
                        }

                        var datapoint;
                        for (datapoint in listOfNodes) {
                            nodes[k++] = listOfNodes[datapoint];
                        }
                    }
                    else {
                        nodes = null;
                    }

                    var count = 0;
                    for (count = 0; count < scope.panelIntervals.length; count++) {
                        d3.select("#hiveplotpanel-" + elem[0].id).append('div')
                            .style("width", function () { return sideLength / width * 100 - 1 + "%"; })
                            .style("height", function () { return sideLength / height * 100 - 1 + "%"; })
                            .attr("class", "hiveplot-innerpanels")
                            .attr("id", "hiveplotpanel-" + count + '' + elem[0].id);

                        d3.select("#hiveplotpanel-" + count + '' + elem[0].id).append('div')
                            .style("height", function () { return 15 + "%"; })
                            .style("font-size", "100%")
                            .html(scope.getDateAsString(new Date(parseInt(scope.panelIntervals[count].startDate, 10))));
                        d3.select("#hiveplotpanel-" + count + '' + elem[0].id).append('div')
                            .style("width", function () { return 100 + "%"; })
                            .style("height", function () { return 85 + "%"; })
                            .attr("id", "hiveplotpanel-low-" + count + '' + elem[0].id);

                        data = prepareData(dataset[scope.panelIntervals[count].startDate][0]);

                        new Hiveplot.Chart({
                            //Mandatory
                            "plotElem": "hiveplotpanel-low-" + count + '' + elem[0].id,     //id of the just created div
                            "data": data,
                            //Optional
                            "tooltipElem": "tooltip-" + elem[0].id,
                            "colorcode": scope.panel.colorcode,                         //possible values: ['black-white', 'colored']
                            "nodesColorSchema": "blue",
                            "linksColorSchema": ['#FFD700', '#FF0000', 10],
                            "axisConfig": axisConfig,
                            "nodes": nodes,
                            "linkMin": Math.min.apply(Math, linkValues),
                            "linkMax": Math.max.apply(Math, linkValues),
                            "tooltipSetting": scope.panel.tooltipSetting,               //possible values: ['none', 'movable', 'static']
                            "sortingTooltip": scope.panel.sortingTooltip,               //possible values: ['source', 'target', 'data']
                            "sortingOrderTooltip": scope.panel.sortingOrderTooltip,     //possible values: [true, false] true means ascending, false means descending
                            "tooltipOrientation": scope.panel.tooltipOrientation,       //possible values: ['horizontal', 'vertical']
                            "onClickNode": function (node) {
                                /*
                                    Here the user can define a function what happens if the user
                                    clicks on a node in the HivePlot.
                                    In our case this function should filter the data.
                                */
                                scope.build_search(node.axis, (node.axis === scope.panel.timeField || node.axis === scope.generalTimeField ) ? new Date(node.label.replace(" ", "T")).getTime() : node.label);
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
                    /*
                        Because of the queries it can happen that the same link is twice in the dataset. Once in the form of from A to B and the otehr time from B to A.
                        The following code removes the dublicates in the array
                    */
                    var orderedData = [];
                    dataset.forEach(function (datapoint) {
                        if (datapoint.axis1 < datapoint.axis2) {
                            orderedData[datapoint.axis1 + '-' + datapoint.source + '-' + datapoint.axis2 + '-' + datapoint.target] = datapoint;
                        }
                        else {
                            /*changing the chronology of the nodes on the axis. E.g. if the link went from Axis_A to Axis_B, after that the link goes from Axis_B to Axis_A*/
                            var object = {
                                axis1: datapoint.axis2,
                                source: datapoint.target,
                                axis2: datapoint.axis1,
                                target: datapoint.source,
                                data: datapoint.data
                            };
                            orderedData[object.axis1 + '-' + object.source + '-' + object.axis2 + '-' + object.target] = object;
                        }
                    });
                    var uniqueData = [];

                    var datapointInOrderedData;
                    for (datapointInOrderedData in orderedData) {
                        uniqueData.push(orderedData[datapointInOrderedData]);
                    }

                    var newData = [];
                    uniqueData.forEach(function (link) {
                        var object = {
                            axis1: link.axis1,
                            axis1NodeLabel: (link.axis1 === scope.panel.timeField || link.axis1 === scope.generalTimeField ) ? scope.getDateAsString(new Date(parseInt(link.source, 10))) : link.source.toString(),
                            axis2: link.axis2,
                            axis2NodeLabel: (link.axis2 === scope.panel.timeField || link.axis2 === scope.generalTimeField) ? scope.getDateAsString(new Date(parseInt(link.target, 10))) : link.target.toString(),
                            value: link.data
                        };
                        newData.push(object);
                    });
                    return newData;
                }
            }
        });
    }
);
