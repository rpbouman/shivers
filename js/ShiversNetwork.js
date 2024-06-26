/*

Copyright 2017 http://www,just-bi.nl; Roland Bouman (roland.bouman@gmail.com)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/
(function(exports){
  
var ShiversNetwork;
(ShiversNetwork = function(conf){
  this.tree = conf.tree;
  this.log = conf.log;
  this.visNodes = [];
  this.visEdges = [];
}).prototype = {
  getVisNodeId: function(conf){
    var id = "";
    if (conf.packageName) {
      id = conf.packageName;
    }
    if (conf.localName) {
      if (id.length) {
        id += "::";
      }
      id += conf.localName;
    }
    if (conf.schemaName) {
      id = conf.schemaName + (id.length ? "." + id : "");
    };
    if (conf.type) {
      id = conf.type + (id.length ? "-" + id : "");
    }
    return id;
  },
  getVisNodeLabel: function(conf){
    var label;
    switch (conf.type) {
      case "schema":
        label = conf.schemaName;
        break;
      case "package":
        label = conf.packageName;
        break;
      case "table":
        label = conf.schemaName + ".";
        label += conf.packageName && conf.packageName.length ? conf.packageName + "::" : "";
        label += conf.localName;        
        break;
      default:
        label = conf.packageName + "\n" + conf.localName;
    }
    return label;
  },
  createVisNodeData: function (conf){
    var visNodeData = {
      id: this.getVisNodeId(conf),
      label: this.getVisNodeLabel(conf),
      shape: "image",
      image: "img/" + conf.type + "128x128.png",
      //physics: false,
      physics: true,
      type: conf.type,
      font: "18px verdana grey normal"
    };
    this.visNodes.push(visNodeData);
    this.log.info("Created node " + this.visNodes.length + " with id: " + visNodeData.id + ".");
    return visNodeData;
  },
  createVisEdgeData: function(from, to){
    var visEdgeData = {
      from: typeof(from) === "object" ? from.id : from,
      to: typeof(to) === "object" ? to.id : to,
      arrows: "to",
      smooth: {type: "cubicBezier"},
      physics: false
    };
    this.visEdges.push(visEdgeData);
    this.log.info("Created edge " + this.visEdges.length + " from " + visEdgeData.from + " to " + visEdgeData.to + ".");
    return visEdgeData;
  },
  getVisNodeDataForTab: function (tab){
    var parts, treeNodeId = tab.forTreeNode;
    parts = treeNodeId.split(":");
    var pkg = parts[1];
    parts = parts[3].split(".");
    var name = parts[0];
    var type = parts[1];
    var visNodeData = this.getVisNodeData({
      packageName: pkg, 
      localName: name, 
      type: type
    });
    visNodeData.font = "18px verdana black bold";
    return visNodeData;
  },
  findVisNodeData: function(conf){
    var visNodeId = this.getVisNodeId(conf);
    var existingVisNodeData = this.visNodes.filter(function(node, index){
      return node.id === visNodeId;
    });
    var visNodeData;
    switch (existingVisNodeData.length) {
      case 0:
        visNodeData = null;
        break;
      case 1:
        visNodeData = existingVisNodeData[0];
        break;
      default:
        throw "Duplicate node!"
    }
    return visNodeData;
  },
  getVisNodeData: function(conf){
    var visNodeData = this.findVisNodeData(conf);
    if (visNodeData === null) {
      visNodeData = this.createVisNodeData(conf);
      if (conf.packageName && conf.packageName.length && conf.type !== "package") {
        var packageNodeData, prevPackageNodeData;
        var packageNameParts = conf.packageName.split(".");
        packageNameParts.forEach(function(packageNamePart, index){
          packageNodeData = this.getVisNodeDataForPackage(packageNameParts.slice(0, 1+index).join("."));
          if (prevPackageNodeData) {
            this.createVisEdgeData(packageNodeData, prevPackageNodeData);
          }
          prevPackageNodeData = packageNodeData;
        }.bind(this));
        this.createVisEdgeData(visNodeData, packageNodeData);
      }
    }
    return visNodeData;
  },
  getVisNodeDataForPackage: function(packageName){
    //to do: create and connect subpackage.
    var packageVisNodeData = this.getVisNodeData({
      packageName: packageName,
      type: "package"
    });
    return packageVisNodeData;
  },
  getVisNodeDataForSchema: function(name){
    var schemaVisNodeData = this.getVisNodeData({
      schemaName: name, 
      type: "schema"
    });
    return schemaVisNodeData;
  },
  parseSchemaObjectName: function(schemaObjectName){
    var colonColon = "::";
    var indexOfColonColon = schemaObjectName.indexOf(colonColon);
    var packageName;
    if (indexOfColonColon !== -1) {
      packageName = schemaObjectName.substr(0, indexOfColonColon);
      schemaObjectName = schemaObjectName.substr(indexOfColonColon + colonColon.length);
    }
    return {
      localName: schemaObjectName,
      packageName: packageName
    };
  },
  getVisNodeDataForTableNode: function(tableNode){
    var attributes = extractAttributes(tableNode, ["schemaName", "columnObjectName"]);
    var tableId = this.parseSchemaObjectName(attributes.columnObjectName);
    var columnObjectInfo = {
      packageName: tableId.packageName, 
      localName: tableId.localName, 
      schemaName: attributes.schemaName, 
      type: "table"
    };
    var tableVisNodeData = this.findVisNodeData(columnObjectInfo);
    if (!tableVisNodeData) {
      tableVisNodeData = this.getVisNodeData(columnObjectInfo);
      var schemaVisNodeData = this.getVisNodeDataForSchema(attributes.schemaName);
      this.createVisEdgeData(tableVisNodeData, schemaVisNodeData);
    }
    return tableVisNodeData;
  },
  getVisNodeDataForDbViewNode: function(tableNode){
    var attributes = extractAttributes(tableNode, ["schemaName", "columnObjectName"]);
    var tableId = this.parseSchemaObjectName(attributes.columnObjectName);
    var columnObjectInfo = {
      packageName: tableId.packageName, 
      localName: tableId.localName, 
      schemaName: attributes.schemaName, 
      type: "dbview"
    };
    var dbViewVisNodeData = this.findVisNodeData(columnObjectInfo);
    if (!dbViewVisNodeData) {
      dbViewVisNodeData = this.getVisNodeData(columnObjectInfo);
      var schemaVisNodeData = this.getVisNodeDataForSchema(attributes.schemaName);
      this.createVisEdgeData(dbViewVisNodeData, schemaVisNodeData);
    }
    return dbViewVisNodeData;
  },
  parseResourceUri: function(resourceUri){
    var parts = resourceUri.split("/");
    var pkg = parts[1];
    var name = parts[3];
    var type = parts[2];
    type = type.substr(0, type.length - 1);
    return {
      pkg: pkg,
      name: name,
      type: type
    };
  },
  visualizeResourceUri: function(viewNode, resourceUri){
    resourceUri = this.parseResourceUri(resourceUri);
    var info = {
      packageName: resourceUri.pkg, 
      localName: resourceUri.name, 
      type: resourceUri.type
    };
    var visNode = this.findVisNodeData(info);

    if (!visNode) {
      visNode = this.getVisNodeData(info);
      var treeNode = this.tree.getViewTreeNode(resourceUri.pkg, resourceUri.name, resourceUri.type);
      if (treeNode){
        var conf = treeNode.getConf();
        this.visualizeViewContents(visNode, conf.metadata);
      }
      else {
        var msg = "Warning: no treenode found for attribute view " + visNode.id + ". Skipped.";
        this.log.warn(msg);
      }
    }
    this.createVisEdgeData(viewNode.id, visNode.id);
  },
  visualizeSharedDimensions: function(analyticViewNode, privateMeasureGroupNode){
    var sharedDimensions = extractChildElement(privateMeasureGroupNode, "sharedDimensions");
    if (sharedDimensions.childNodes) {
      sharedDimensions.childNodes.forEach(function(sharedDimension){
        if (sharedDimension.nodeName !== "logicalJoin"){
          this.log.warn("Found a " + sharedDimension.nodeName + " inside sharedDimensions.");
          return;
        }
        var associatedObjectUri = extractAttribute(sharedDimension, "associatedObjectUri");
        this.visualizeResourceUri(analyticViewNode, associatedObjectUri);
      }.bind(this));
    }
  },
  visualizeAnalyticViewContents: function (analyticViewNode, viewData){
    var documentElement = extractDocumentElement(viewData);
    
    var entryNode;
    switch (documentElement.nodeName) {
      case "cube":
        entryNode = extractChildElement(documentElement, "privateMeasureGroup");
        this.visualizeSharedDimensions(analyticViewNode, entryNode);
        break;
      case "dimension":
        entryNode = documentElement;
        break;
    }
    var privateDataFoundation = extractChildElement(entryNode, "privateDataFoundation");
    var tableProxies = extractChildElement(privateDataFoundation, "tableProxies");
    var centralTableProxy;
    tableProxies.childNodes.forEach(function(node, index){
      if (node.nodeName !== "tableProxy") {
        this.log.warn("Found a " + node.nodeName + " inside the tableProxies node.");
        return;
      }
      var tableNode = extractChildElement(node, "table");
      var tableVisNodeData = this.getVisNodeDataForTableNode(tableNode);
      if (!centralTableProxy) {
        centralTableProxy = tableVisNodeData;
      }
      else     
      if (node.attributes) {
        var centralTableAttribute = extractAttribute(node, "centralTable");
        if (centralTableAttribute === "true") {
          centralTableProxy = tableVisNodeData;
        }
      }
    }.bind(this));
    if (centralTableProxy) {
      this.createVisEdgeData(analyticViewNode.id, centralTableProxy.id);
    }
    
    var joins = extractChildElement(privateDataFoundation, "joins");
    if (joins.childNodes) {
      joins.childNodes.forEach(function(node, index){
        if (node.nodeName !== "join") {
          this.log.warn("Found a " + node.nodeName + " inside the joins node.");
          return;
        }
        var leftTable = extractChildElement(node, "leftTable");
        var leftTableVisNodeData = this.getVisNodeDataForTableNode(leftTable);
        
        var rightTable = extractChildElement(node, "rightTable");
        var rightTableVisNodeData = this.getVisNodeDataForTableNode(rightTable);

        this.createVisEdgeData(leftTableVisNodeData.id, rightTableVisNodeData.id);
      }.bind(this));
    }  
  },
  visualizeCalculationViewContents: function(calculationViewNode, viewData){
    var documentElement = extractDocumentElement(viewData);
    var dataSources = extractChildElement(documentElement, "dataSources");
    if (dataSources.childNodes) {
      dataSources.childNodes.forEach(function(node, index){
        if (node.nodeName !== "DataSource") {
          this.log.warn("Warning: found a " + node.nodeName + " node inside the datasources node. Skipping.");
          return;
        }
        var type = extractAttribute(node, "type");
        switch (type) {
          case "ANALYTIC_VIEW":
          case "ATTRIBUTE_VIEW":
          case "CALCULATION_VIEW":
            var resourceUri = extractText(node, "resourceUri");
            this.visualizeResourceUri(calculationViewNode, resourceUri);
            break;
          case "DATA_BASE_TABLE":
            var columnObject = extractChildElement(node, "columnObject");
            var columnObjectVisNodeData = this.getVisNodeDataForTableNode(columnObject);
            this.createVisEdgeData(calculationViewNode.id, columnObjectVisNodeData.id);
            break;
          case "DATA_BASE_VIEW":
            var columnObject = extractChildElement(node, "columnObject");
            var columnObjectVisNodeData = this.getVisNodeDataForDbViewNode(columnObject);
            this.createVisEdgeData(calculationViewNode.id, columnObjectVisNodeData.id);
            break;
          default:
            this.log.warn("Warning: don't know how to handle DataSource nodes of type " + type + ". Skipping.");
            return;
        }
      }.bind(this));
    }
  },
  visualizeViewContents: function(viewNode, viewData){
    var documentElement = extractDocumentElement(viewData);
    var method;
    switch (documentElement.nodeName) {
      case "cube":
      case "dimension":
        method = this.visualizeAnalyticViewContents;
        break;
      case "scenario":
        method = this.visualizeCalculationViewContents;
        break;
    }
    method.call(this, viewNode, viewData);
  },
  visualizeView: function (tab, doc){
    this.log.info("Visualizing view with id: " + tab.forTreeNode);
    var viewNode = this.getVisNodeDataForTab(tab);
    this.visualizeViewContents(viewNode, doc);
    this.log.info("Visualizing a graph of " + this.visNodes.length + " nodes and " + this.visEdges.length + " edges.");
    this.visNetwork = new vis.Network(tab.component.getDom(), {
      nodes: new vis.DataSet(this.visNodes),
      edges: new vis.DataSet(this.visEdges)
    }, {
      layout: { /*
        hierarchical: {
          direction: "UD" ,
          levelSeparation: 150	
        } */
      },
      physics: {
        enabled: false,
        /*
        hierarchicalRepulsion: {
          nodeDistance: 150
        }*/
      },
      manipulation: {
        editNode: function(data, callback){
          var type = data.type;
          switch (type) {
            case "package":
              break;
            case "schema":
              break;
            case "table":
              break;
            default:
              alert("Don't know how to handle type " + type);
          }
          callback(data);
        }
      }
    });
    tab.shiversNetwork = this;
    this.log.info("Done visualizing view with id: " + tab.forTreeNode);
  }
};

adopt(ShiversTree, ContentPane);

exports.ShiversNetwork = ShiversNetwork;
  
})(typeof(exports) === "undefined" ? window : exports);
